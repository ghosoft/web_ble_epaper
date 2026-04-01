/**
 * 蓝牙操作.js —— Web BLE 底层通信库
 *
 * 职责：
 *   · 设备扫描 & GATT 连接
 *   · TX / RX 特征值读写
 *   · 通知（Notify）订阅管理
 *   · 断线检测与状态回调
 *
 * 不包含：任何 ESP32 应用层协议逻辑
 *
 * 全局导出：BLE
 */

const BLE = (() => {

  /* ── 连接状态 ─────────────────────────────────────────────────────────── */
  const state = {
    connected:       false,
    device:          null,
    server:          null,
    service:         null,
    characteristics: null,
    ch_tx:           null,   // 写指令通道  (默认 0xFF05)
    ch_rx:           null,   // 读数据通道  (默认 0xFF04)
    ch_status:       null,   // 通知通道    (默认 0xFF01)
    deviceIp:        '',     // 由上层协议写入，此处统一保管
  };

  /* ── 回调（由应用层通过 init() 注入）────────────────────────────────── */
  let _log            = (...a) => console.log('[BLE]', ...a);
  let _onStatusChange = null;   // (state: 'connecting'|'connected'|'disconnected'|'error') => void
  let _onNotification = null;   // (event: Event) => void  ← FF01 通知
  let _onDisconnected = null;   // () => void

  /* ═══════════════════════════════════════════════════════════════════════
   *  公开 API
   * ═══════════════════════════════════════════════════════════════════════ */

  /**
   * 初始化：注册回调函数
   *
   * @param {Object}   opts
   * @param {Function} [opts.log]            - 日志函数，替代 console.log
   * @param {Function} [opts.onStatusChange] - 状态变更回调
   * @param {Function} [opts.onNotification] - 蓝牙通知回调
   * @param {Function} [opts.onDisconnected] - 断线回调
   */
  function init({ log, onStatusChange, onNotification, onDisconnected } = {}) {
    if (log)             _log             = log;
    if (onStatusChange)  _onStatusChange  = onStatusChange;
    if (onNotification)  _onNotification  = onNotification;
    if (onDisconnected)  _onDisconnected  = onDisconnected;
  }

  /**
   * 检查浏览器是否支持 Web Bluetooth
   * @returns {boolean}
   */
  function isSupported() {
    if (navigator.bluetooth) return true;
    _log('Web Bluetooth API 不可用，请启用 Experimental Web Platform features。');
    return false;
  }

  /**
   * 扫描并连接蓝牙设备，自动获取指定服务和特征值
   *
   * @param {RequestDeviceOptions} scanOptions  - navigator.bluetooth.requestDevice 参数
   * @param {Object}               uuids
   * @param {number|string}        uuids.serviceUuid  - 主服务 UUID (如 0x00FF)
   * @param {number|string}        uuids.txUuid       - 写特征值 UUID (如 0xFF05)
   * @param {number|string}        uuids.rxUuid       - 读特征值 UUID (如 0xFF04)
   * @param {number|string}        uuids.statusUuid   - 通知特征值 UUID (如 0xFF01)
   * @returns {Promise<void>}
   */
  async function connect(scanOptions, { serviceUuid, txUuid, rxUuid, statusUuid }) {
    if (!isSupported()) throw new Error('Web Bluetooth 不支持');

    _onStatusChange?.('connecting');
    _log('正在请求蓝牙设备...', JSON.stringify(scanOptions));

    state.device = await navigator.bluetooth.requestDevice(scanOptions);

    /* 断线监听 */
    state.device.addEventListener('gattserverdisconnected', _handleDisconnected);

    _log('正在连接 GATT Server...');
    state.server = await _withTimeout(state.device.gatt.connect(), 25000, 'GATT连接');

    _log('正在获取主服务...');
    state.service = await _withTimeout(
      state.server.getPrimaryService(serviceUuid), 25000, '服务获取'
    );

    _log('正在枚举特征值...');
    state.characteristics = await _withTimeout(
      state.service.getCharacteristics(), 5000, '特征枚举'
    );
    _log('全部特征值 UUID:', state.characteristics.map(c => c.uuid).join(' | '));

    state.ch_tx     = await state.service.getCharacteristic(txUuid);
    state.ch_rx     = await state.service.getCharacteristic(rxUuid);
    state.ch_status = await state.service.getCharacteristic(statusUuid);

    _log('[TX ]', _describeChar(state.ch_tx));
    _log('[RX ]', _describeChar(state.ch_rx));
    _log('[STS]', _describeChar(state.ch_status));

    _log('正在订阅通知...');
    await _withTimeout(state.ch_status.startNotifications(), 5000, '通知启动');
    if (_onNotification) {
      state.ch_status.addEventListener('characteristicvaluechanged', _onNotification);
    }

    state.connected = true;
    _log('✅ BLE 全部通道就绪 (TX / RX / STS)');
    _onStatusChange?.('connected');
  }

  /**
   * 向 TX 特征值写入数据
   *
   * @param {Uint8Array} data
   * @param {boolean}    [withResponse=true]  false → writeValue (无需等待应答)
   * @returns {Promise<void>}
   */
  async function write(data, withResponse = true) {
    if (!state.ch_tx) throw new Error('BLE 未连接，TX 特征值不可用');
    return withResponse
      ? state.ch_tx.writeValueWithResponse(data)
      : state.ch_tx.writeValue(data);
  }

  /**
   * 从 RX 特征值读取一次数据
   *
   * @param {number} [timeoutMs=5000]
   * @returns {Promise<DataView>}
   */
  async function read(timeoutMs = 5000) {
    if (!state.ch_rx) throw new Error('BLE 未连接，RX 特征值不可用');
    return _withTimeout(state.ch_rx.readValue(), timeoutMs, 'RX 读取');
  }

  /**
   * Promise 超时竞赛工具（也供上层模块使用）
   *
   * @param {Promise}  promise
   * @param {number}   ms
   * @param {string}   label   - 超时时的错误描述
   * @returns {Promise}
   */
  function withTimeout(promise, ms, label) {
    return _withTimeout(promise, ms, label);
  }

  /* ═══════════════════════════════════════════════════════════════════════
   *  内部私有函数
   * ═══════════════════════════════════════════════════════════════════════ */

  function _withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`超时: ${label} (${ms}ms)`)), ms)
      )
    ]);
  }

  function _handleDisconnected() {
    _log('⚠️ 蓝牙连接意外断开！');
    _resetState();
    _onStatusChange?.('disconnected');
    _onDisconnected?.();
  }

  function _resetState() {
    state.connected       = false;
    state.server          = null;
    state.service         = null;
    state.characteristics = null;
    state.ch_tx           = null;
    state.ch_rx           = null;
    state.ch_status       = null;
    // deviceIp 由上层自行决定何时清除
  }

  function _describeChar(char) {
    const p = char.properties;
    return `${char.uuid}  read=${p.read} write=${p.write} writeNoRsp=${p.writeWithoutResponse} notify=${p.notify} indicate=${p.indicate}`;
  }

  /* ── 公开 API ─────────────────────────────────────────────────────────── */
  return {
    /** 当前蓝牙连接状态（ch_tx / ch_rx / deviceIp 等可直接读写） */
    state,
    init,
    isSupported,
    connect,
    write,
    read,
    withTimeout,
  };

})();
