/**
 * 协议.js —— ESP32 电子纸应用层协议库
 *
 * 职责：
 *   · 定义与 ESP32 约定的全部命令码（EPD.CMD）
 *   · 封装每条命令的编码、发送、接收与解析
 *   · 设备型号列表
 *
 * 依赖：BLE 全局对象（蓝牙操作.js 必须先加载）
 *
 * 全局导出：EPD
 */

const EPD = (() => {

  /* ═══════════════════════════════════════════════════════════════════════
   *  与 ESP32 约定的命令码
   * ═══════════════════════════════════════════════════════════════════════ */
  const CMD = Object.freeze({
    RESET_EPD:        0x00, // 复位 EPD
    SET_EPD_NAME:     0x01, // 设置屏幕型号名称：[0x01, ...name_utf8]
    REPORT_EPD_INFO:  0x02, // 请求设备信息（下次 read 返回 JSON）
    START_WRITE_DATA: 0x03, // 开始图像传输：[0x03, b3, b2, b1, b0]（4 字节大端总长度）
    CURRENT_PACKET:   0x04, // 数据包：[0x04, idx_b3..b0, ...payload]
    END_WRITE_DATA:   0x05, // 结束图像传输
    EPD_CLEAR:        0x06, // 清屏：[0x06, colorIndex]
    BATTERY_LEVEL:    0x07, // 查询电量（2 字节，10mV/bit）
    SET_WIFI:         0x08, // 设置 WiFi / 查询 IP：[0x08, ssid_len, pwd_len, ...ssid, ...pwd]
    SET_WORKING_MODE: 0x09, // 设置工作模式：[0x09, mode]（0=正常, 1=相册）
    SET_CUSTOM_NAME:  0x0A, // 设置自定义蓝牙名称：[0x0A, ...name_utf8]
    QUERY_PROGRESS:   0x0B, // 查询传输进度（返回 2 字节百分比）
  });

  /* ═══════════════════════════════════════════════════════════════════════
   *  设备型号列表
   * ═══════════════════════════════════════════════════════════════════════ */
  const MODEL_LIST = [
    "YMS9841304-1248CIH-E5-V2",
    "YMS16001200-1330AAX-E6",
    "YMS800480-073AAX-E6",
    "YMS400600-040AAX-E6",
    // 继续添加...
  ];

  /* ═══════════════════════════════════════════════════════════════════════
   *  传输参数
   * ═══════════════════════════════════════════════════════════════════════ */
  /** BLE 单包图像数据载荷字节数（不含 5 字节包头） */
  const BLE_CHUNK_SIZE = 490;

  /* ── 日志 ─────────────────────────────────────────────────────────────── */
  let _log = (...a) => console.log('[EPD]', ...a);

  const _enc = new TextEncoder();
  const _dec = new TextDecoder('utf-8');

  /* ═══════════════════════════════════════════════════════════════════════
   *  公开 API
   * ═══════════════════════════════════════════════════════════════════════ */

  /**
   * 初始化：注入日志函数
   * @param {{ log?: Function }} opts
   */
  function init({ log } = {}) {
    if (log) _log = log;
  }

  /* ── 设备信息 ─────────────────────────────────────────────────────────── */

  /**
   * 请求设备信息并解析
   * 内部流程：发 CMD_REPORT_EPD_INFO → 读 RX → JSON 解析
   *
   * @returns {Promise<DeviceInfo>}
   *   { name, width, height, bpp, palette: [[r,g,b], ...], raw }
   */
  async function getDeviceInfo() {
    _log('📡 发送 CMD_REPORT_EPD_INFO...');
    await BLE.write(new Uint8Array([CMD.REPORT_EPD_INFO]));

    const value = await BLE.read(5000);
    const bytes = new Uint8Array(value.buffer);
    _log(`✅ 读取设备信息，共 ${bytes.length} 字节:`,
      bytes.map(b => b.toString(16).padStart(2, '0')).join(' '));

    if (bytes.length === 0) {
      throw new Error('读取到空数据，可能是新设备，需要先设置型号');
    }

    return parseDeviceInfo(value);
  }

  /**
   * 解析设备信息 DataView → 结构化对象
   *
   * @param   {DataView} dataView
   * @returns {DeviceInfo}
   */
  function parseDeviceInfo(dataView) {
    const jsonStr = _dec.decode(dataView);
    _log('设备信息 JSON:', jsonStr);

    const obj = JSON.parse(jsonStr);

    const palette = obj.palette
      ? obj.palette.split(';').map(c => c.split(',').map(Number))
      : [];

    return {
      name:    obj.name   ?? '未知',
      width:   obj.width  ?? 0,
      height:  obj.height ?? 0,
      bpp:     obj.bpp    ?? 0,
      palette,
      raw: obj,
    };
  }

  /* ── WiFi ─────────────────────────────────────────────────────────────── */

  /**
   * 发送 WiFi 配置（SSID + 密码）到设备
   * 帧格式：[0x08, ssid_len, pwd_len, ...ssid_utf8, ...pwd_utf8]
   *
   * @param {string} ssid
   * @param {string} password
   */
  async function setWifi(ssid, password) {
    const ssidBytes = _enc.encode(ssid);
    const pwdBytes  = _enc.encode(password);

    const frame = new Uint8Array(1 + 1 + 1 + ssidBytes.length + pwdBytes.length);
    frame[0] = CMD.SET_WIFI;
    frame[1] = ssidBytes.length;
    frame[2] = pwdBytes.length;
    frame.set(ssidBytes, 3);
    frame.set(pwdBytes,  3 + ssidBytes.length);

    _log(`📡 发送 WiFi 配置: SSID="${ssid}" (共 ${frame.length} 字节)`);
    await BLE.write(frame, false); // 发送后不等应答，设备会自行连接
    _log('✅ WiFi 指令发送完成');
  }

  /**
   * 查询当前设备 IP（单次）
   * 发送 CMD_SET_WIFI 查询帧，读取 RX 返回的 IP 字符串
   *
   * @param   {number} [timeoutMs=5000]
   * @returns {Promise<string>}  IP 字符串，"0.0.0.0" 表示尚未连接
   */
  async function getIp(timeoutMs = 5000) {
    await BLE.write(new Uint8Array([CMD.SET_WIFI]));
    const value    = await BLE.read(timeoutMs);
    const ipString = _dec.decode(value).trim();
    _log(`📡 IP 查询结果: "${ipString}"`);
    return ipString;
  }

  /**
   * 等待 WiFi 连接并轮询获取 IP（阻塞式）
   *
   * @param {(msg: string) => void} [onProgress] - 每次轮询前调用，传入进度文本
   * @param {number} [pollIntervalMs=2000]        - 轮询间隔
   * @param {number} [timeoutMs=60000]            - 最大等待时长
   * @returns {Promise<string>}  成功获取到的 IP 字符串
   * @throws 超时或多次失败时抛出 Error
   */
  async function waitForIp(onProgress, pollIntervalMs = 2000, timeoutMs = 60000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const elapsed = Math.floor((Date.now() - (deadline - timeoutMs)) / 1000);
      onProgress?.(`正在连接 WiFi... (${elapsed}s)`);

      try {
        const ip = await getIp(3000);
        if (ip && ip !== '0.0.0.0') {
          _log(`🌐 WiFi 已连接，IP: ${ip}`);
          return ip;
        }
      } catch (e) {
        _log(`⚠️ 轮询 IP 失败: ${e.message}`);
      }

      await _delay(pollIntervalMs);
    }

    throw new Error('WiFi 连接超时，请检查 SSID 和密码是否正确');
  }

  /* ── 设备配置 ─────────────────────────────────────────────────────────── */

  /**
   * 设置屏幕型号（持久化到 NVS）
   * 帧格式：[0x01, ...name_utf8]
   *
   * @param {string} modelName
   */
  async function setDeviceName(modelName) {
    const nameBytes = _enc.encode(modelName);
    const payload   = new Uint8Array(1 + nameBytes.length);
    payload[0] = CMD.SET_EPD_NAME;
    payload.set(nameBytes, 1);

    _log(`📡 发送型号设置: "${modelName}" (${payload.length} 字节)`);
    await BLE.write(payload);
    _log('📨 型号指令已送达，等待硬件确认...');
  }

  /**
   * 设置蓝牙广播自定义名称
   * 帧格式：[0x0A, ...name_utf8]
   *
   * @param {string} customName
   */
  async function setCustomName(customName) {
    const nameBytes = _enc.encode(customName);
    const payload   = new Uint8Array(1 + nameBytes.length);
    payload[0] = CMD.SET_CUSTOM_NAME;
    payload.set(nameBytes, 1);

    _log(`📡 发送自定义名称: "${customName}" (${payload.length} 字节)`);
    await BLE.write(payload);
    _log('📨 自定义名称指令已送达');
  }

  /**
   * 设置工作模式
   * 帧格式：[0x09, mode]
   *
   * @param {number} mode  0=正常模式，1=相册模式
   */
  async function setWorkingMode(mode) {
    const payload = new Uint8Array([CMD.SET_WORKING_MODE, mode & 0xFF]);
    _log(`📡 发送工作模式: ${mode} (0x${mode.toString(16).padStart(2, '0')})`);
    await BLE.write(payload);
    _log('✅ 工作模式设置完成');
  }

  /**
   * 清屏
   * 帧格式：[0x06, colorIndex]
   *
   * @param {number} colorIndex  调色板索引（0=第一种颜色）
   */
  async function clearScreen(colorIndex) {
    const payload = new Uint8Array([CMD.EPD_CLEAR, colorIndex & 0xFF]);
    _log(`📡 发送清屏指令: CMD=0x06, ColorIndex=${colorIndex}`);
    await BLE.write(payload, false);
    _log('✅ 清屏指令发送完成');
  }

  /* ── 图像传输（BLE）─────────────────────────────────────────────────── */

  /**
   * 通过 BLE 分包传输图像数据
   *
   * 协议流程：
   *   START_WRITE_DATA(总字节数) → N × CURRENT_PACKET(索引, 数据) → END_WRITE_DATA
   *
   * @param {Uint8Array}              data          - 已打包的图像位数据
   * @param {(percent: number)=>void} [onProgress]  - 进度回调，参数为 0~100
   * @returns {Promise<void>}
   */
  async function sendImageBle(data, onProgress) {
    const totalBytes   = data.length;
    const totalPackets = Math.ceil(totalBytes / BLE_CHUNK_SIZE);

    _log(`开始 BLE 图像传输: ${totalBytes} 字节，${totalPackets} 包，每包 ${BLE_CHUNK_SIZE} 字节数据`);

    /* 1. 开始帧：[0x03, b3, b2, b1, b0] */
    const startCmd = new Uint8Array(5);
    startCmd[0] = CMD.START_WRITE_DATA;
    startCmd[1] = (totalBytes >>> 24) & 0xFF;
    startCmd[2] = (totalBytes >>> 16) & 0xFF;
    startCmd[3] = (totalBytes >>>  8) & 0xFF;
    startCmd[4] =  totalBytes         & 0xFF;
    _log(`📡 发送开始帧: 总大小 ${totalBytes} 字节`);
    await BLE.write(startCmd, false);

    /* 2. 数据帧：[0x04, idx_b3..b0, ...payload] */
    for (let i = 0; i < totalPackets; i++) {
      const start      = i * BLE_CHUNK_SIZE;
      const end        = Math.min(start + BLE_CHUNK_SIZE, totalBytes);
      const payloadLen = end - start;

      const packet = new Uint8Array(5 + payloadLen);
      packet[0] = CMD.CURRENT_PACKET;
      packet[1] = (i >>> 24) & 0xFF;
      packet[2] = (i >>> 16) & 0xFF;
      packet[3] = (i >>>  8) & 0xFF;
      packet[4] =  i         & 0xFF;
      packet.set(data.slice(start, end), 5);

      await BLE.write(packet, true); // writeValueWithResponse 确保到达

      const pct = (i + 1) / totalPackets * 100;
      if (i % 10 === 0 || i === totalPackets - 1) {
        _log(`进度: ${pct.toFixed(1)}% (${i + 1}/${totalPackets})`);
      }
      onProgress?.(pct);
    }

    /* 3. 结束帧 */
    _log('📡 发送结束帧');
    await BLE.write(new Uint8Array([CMD.END_WRITE_DATA]), false);
    _log('✅ BLE 图像传输完成');
  }

  /* ── 进度查询 ─────────────────────────────────────────────────────────── */

  /**
   * 向设备查询当前传输进度（主要用于 WiFi 发图时的蓝牙进度反馈）
   * 返回 0 ~ 100 的整数百分比
   *
   * @returns {Promise<number>}
   */
  async function queryProgress() {
    await BLE.write(new Uint8Array([CMD.QUERY_PROGRESS]));
    const value = await BLE.read(1000);
    const bytes = new Uint8Array(value.buffer);
    if (bytes.length >= 2) {
      return (bytes[0] << 8) | bytes[1];
    }
    return 0;
  }

  /* ── 通知解析 ─────────────────────────────────────────────────────────── */

  /**
   * 解析 FF01 通知事件（ESP32 主动推送的状态码）
   * 应在 BLE.init({ onNotification }) 回调中调用此函数
   *
   * @param   {Event} event - characteristicvaluechanged 事件
   * @returns {{ code: number, message: string }}
   */
  function handleNotification(event) {
    const code = event.target.value.getUint8(0);
    let message;

    switch (code) {
      case 0x81:
        message = '✅ 硬件反馈: 型号设置成功，已保存到 NVS';
        break;
      case 0x8F:
        message = '❌ 硬件反馈: 型号设置失败（型号无效）';
        break;
      default:
        message = `📡 收到未知状态码: 0x${code.toString(16).padStart(2, '0')}`;
    }

    return { code, message };
  }

  /* ── 内部工具 ─────────────────────────────────────────────────────────── */
  function _delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  /* ═══════════════════════════════════════════════════════════════════════
   *  公开 API
   * ═══════════════════════════════════════════════════════════════════════ */
  return {
    CMD,
    MODEL_LIST,
    BLE_CHUNK_SIZE,
    init,
    /* 设备信息 */
    getDeviceInfo,
    parseDeviceInfo,
    /* WiFi */
    setWifi,
    getIp,
    waitForIp,
    /* 设备配置 */
    setDeviceName,
    setCustomName,
    setWorkingMode,
    clearScreen,
    /* 图像传输 */
    sendImageBle,
    queryProgress,
    /* 通知解析 */
    handleNotification,
  };

})();
