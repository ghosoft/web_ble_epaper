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

  /* ── 平台检测 ─────────────────────────────────────────────────────────── */
  function isBluefy() {
    return navigator.userAgent.includes('Bluefy');
  }

  function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

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
  let _isRetrying = false;      // 自动重试中，抑制断开回调

  /* ═══════════════════════════════════════════════════════════════════════
   *  公开 API
   * ═══════════════════════════════════════════════════════════════════════ */

  function _uuidMatch(char, uuidNum) {
    var hex = uuidNum.toString(16).padStart(4, '0');
    var cuuid = typeof char.uuid === 'string'
      ? char.uuid
      : '0000' + char.uuid.toString(16).padStart(4, '0');
    return cuuid.toLowerCase().indexOf(hex) !== -1;
  }

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

    const bluefy = isBluefy();
    _log(`平台检测: ${bluefy ? 'Bluefy (iOS)' : '标准浏览器'}`);

    _onStatusChange?.('connecting');
    _log('正在请求蓝牙设备...', JSON.stringify(scanOptions));

    state.device = await navigator.bluetooth.requestDevice(scanOptions);
    if (bluefy) await delay(500);

    /* 断线监听（两路径共用） */
    state.device.addEventListener('gattserverdisconnected', _handleDisconnected);

    if (bluefy) {
      /* ══════════════════════════════════════════════════════════════════
       * Bluefy (iOS) 路径
       * getCharacteristic() 在 WKWebView 上可能卡死，改用
       * getCharacteristics() 批量枚举 + find() UUID 匹配
       * ══════════════════════════════════════════════════════════════════ */
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          if (attempt > 1) {
            _isRetrying = true;
            _log(`🔄 正在重试 (第${attempt}次)...`);
            await delay(1000);
          }

          state.server = await _withTimeout(state.device.gatt.connect(), 25000, 'GATT连接');
          await delay(500);

          _log('正在获取主服务...');
          state.service = await _withTimeout(
            state.server.getPrimaryService(serviceUuid), 25000, '服务获取'
          );
          await delay(500);

          _log('正在枚举特征值...');
          state.characteristics = await _withTimeout(
            state.service.getCharacteristics(), 5000, '特征枚举'
          );
          _log('全部特征值 UUID:', state.characteristics.map(c => c.uuid).join(' | '));
          await delay(500);

          state.ch_tx     = state.characteristics.find(c => _uuidMatch(c, txUuid));
          state.ch_rx     = state.characteristics.find(c => _uuidMatch(c, rxUuid));
          state.ch_status = state.characteristics.find(c => _uuidMatch(c, statusUuid));
          if (!state.ch_tx || !state.ch_rx || !state.ch_status) {
            throw new Error('特征值获取不完整');
          }

          _log('[TX ]', _describeChar(state.ch_tx));
          _log('[RX ]', _describeChar(state.ch_rx));
          _log('[STS]', _describeChar(state.ch_status));
          await delay(500);

          try {
            _log('正在订阅通知...');
            await _withTimeout(state.ch_status.startNotifications(), 5000, '通知启动');
            if (_onNotification) {
              state.ch_status.addEventListener('characteristicvaluechanged', _onNotification);
            }
            _log('✅ 通知订阅成功');
          } catch (e) {
            _log(`⚠️ 通知订阅失败 (${e.message})，降级为轮询模式`);
          }

          _isRetrying = false;
          state.connected = true;
          _log('✅ BLE 全部通道就绪 (TX / RX / STS)');
          _onStatusChange?.('connected', state.device.name);
          return;
        } catch (e) {
          _log(`❌ 第${attempt}次连接失败: ${e.message}`);
          _resetState();
          if (attempt === 2) {
            _isRetrying = false;
            _onStatusChange?.('disconnected');
            throw e;
          }
        }
      }
    } else {
      /* ══════════════════════════════════════════════════════════════════
       * 标准浏览器路径（Android Chrome）
       * getCharacteristic() 逐个获取，已验证稳定
       * ══════════════════════════════════════════════════════════════════ */
      state.server = await state.device.gatt.connect();

      _log('正在获取主服务...');
      state.service = await state.server.getPrimaryService(serviceUuid);

      _log('正在获取特征值...');
      state.ch_status = await state.service.getCharacteristic(statusUuid);
      state.ch_rx     = await state.service.getCharacteristic(rxUuid);
      state.ch_tx     = await state.service.getCharacteristic(txUuid);

      _log('[TX ]', _describeChar(state.ch_tx));
      _log('[RX ]', _describeChar(state.ch_rx));
      _log('[STS]', _describeChar(state.ch_status));

      try {
        _log('正在订阅通知...');
        await state.ch_status.startNotifications();
        if (_onNotification) {
          state.ch_status.addEventListener('characteristicvaluechanged', _onNotification);
        }
        _log('✅ 通知订阅成功');
      } catch (e) {
        _log(`⚠️ 通知订阅失败 (${e.message})，降级为轮询模式`);
      }

      state.connected = true;
      _log('✅ BLE 全部通道就绪 (TX / RX / STS)');
      _onStatusChange?.('connected', state.device.name);
    }
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
    const methods = [];
    if (withResponse) {
      methods.push(() => state.ch_tx.writeValueWithResponse(data));
    }
    methods.push(() => state.ch_tx.writeValue(data));
    let lastErr;
    for (const fn of methods) {
      try {
        const r = await fn();
        return r;
      } catch (e) {
        lastErr = e;
        _log(`⚠️ 写入尝试失败: ${e.message}`);
      }
    }
    throw lastErr || new Error('写入失败');
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
    if (_isRetrying) return;
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
