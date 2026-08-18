(function () {

  const STORAGE_KEY = 'preferred_lang';

  const FALLBACK = {
    "page.title": "BLE 电子纸",
    "status.ble": "蓝牙",
    "status.wifi": "WiFi",
    "status.connecting": "连接中",
    "status.connected": "已连接",
    "status.disconnected": "未连接",
    "status.bleNotConnected": "蓝牙未连接",
    "btn.guide": "引导",
    "btn.advanced": "高级",
    "btn.scan": "扫描",
    "btn.scanWifi": "扫描 WiFi",
    "btn.connectWifi": "连接 WiFi",
    "btn.queryIp": "查询 IP",
    "btn.selectImage": "选择图片",
    "btn.addText": "添加文字",
    "btn.deleteText": "删除选中",
    "btn.sendBle": "蓝牙发送",
    "btn.sendWifi": "WiFi 发送",
    "btn.uploadImage": "选择图片",
    "btn.prevStep": "上一步",
    "btn.nextStep": "下一步",
    "btn.send": "发送",
    "btn.setModel": "设置型号",
    "btn.setName": "设置",
    "btn.setMode": "设置",
    "btn.setInterval": "设置",
    "btn.exportBin": "导出 BIN",
    "btn.importBin": "导入 BIN",
    "btn.refreshPreview": "刷新预览",
    "btn.clearScreen": "清屏",
    "btn.toggleLog": "隐藏",
    "btn.showLog": "显示",
    "btn.saveFlash": "持久化到 Flash",
    "btn.clearFlash": "清空 Flash",
    "btn.close": "✕",
    "btn.finish": "完成",
    "btn.skipTour": "跳过引导",
    "btn.prevTour": "上一步",
    "btn.nextTour": "下一步",
    "label.namePrefix": "名称前缀",
    "label.ssid": "SSID:",
    "label.password": "密码:",
    "label.ipAddress": "IP 地址:",
    "label.serviceUuid": "服务 UUID",
    "label.characteristic": "特征值",
    "label.scanAll": "扫描所有设备",
    "label.model": "型号:",
    "label.width": "宽:",
    "label.height": "高:",
    "label.bpp": "BPP:",
    "label.palette": "调色板:",
    "label.customName": "自定义名称:",
    "label.workingMode": "工作模式:",
    "label.albumInterval": "相册刷图间隔:",
    "label.minutes": "分钟",
    "label.brightness": "亮度",
    "label.contrast": "对比度",
    "label.colorEnhance": "色彩增强 (LUT)",
    "label.color": "颜色",
    "label.fontSize": "字号",
    "label.logPanel": "日志面板",
    "label.language": "语言:",
    "placeholder.namePrefix": "设备名关键字",
    "placeholder.deviceName": "Device Name",
    "placeholder.notConnected": "未连接",
    "placeholder.serviceUuid": "如 0x00FF",
    "placeholder.characteristic": "可选",
    "placeholder.customName": "蓝牙广播名称",
    "placeholder.textInput": "输入文字...",
    "section.language": "语言",
    "section.bleScanOptions": "蓝牙扫描选项",
    "section.deviceConfig": "设备配置",
    "section.imageOps": "图像操作",
    "section.flashMgmt": "Flash 管理",
    "section.advancedSettings": "高级设置",
    "mode.normal": "0: 正常模式",
    "mode.album": "1: 相册模式",
    "step.crop": "裁剪",
    "step.text": "文字",
    "step.quantize": "量化",
    "crop.placeholder": "点击\"选择图片\"上传",
    "crop.flipH": "水平",
    "crop.flipV": "垂直",
    "crop.rotateL": "CCW90°",
    "crop.rotateR": "CW90°",
    "text.placeholder": "文字编辑预览",
    "quantize.placeholder": "量化预览",
    "quantize.alt": "量化图",
    "overlay.progress": "{val}%",
    "overlay.time": "{s}s",
    "overlay.success": "传输成功",
    "overlay.fail": "传输失败",
    "overlay.processing": "数据处理中,请稍后",
    "device.dimLabel": "屏幕尺寸: {w} × {h} px",
    "device.noDevice": "— 请先连接设备以获取屏幕尺寸 —",
    "alert.enterText": "请输入文字",
    "alert.ssidPwdRequired": "请先输入完整的 SSID 和密码",
    "alert.bleNotConnected": "蓝牙未连接",
    "alert.bleNotConnectedExcl": "蓝牙未连接！",
    "alert.modelRequired": "请先确保型号信息已读取",
    "alert.customNameRequired": "请先输入自定义名称",
    "alert.sendFailed": "发送失败: {msg}",
    "alert.intervalInvalid": "请输入有效的间隔分钟数(1~255)",
    "alert.quantizeFirst": "请先进行图片量化！",
    "alert.wifiNotConnected": "设备未连接 WiFi，请先连接 WiFi 获取 IP",
    "alert.noWifiPersist": "设备未连接 WiFi，无法持久化",
    "alert.confirmClearFlash": "确定要删除 Flash 中保存的所有图片吗？此操作不可撤销。",
    "alert.noWifiClear": "设备未连接 WiFi，无法清空",
    "alert.deviceInfoRequired": "请先确保设备信息已读取（宽/高/调色板）",
    "log.paletteSelected": "已选中调色板颜色索引: {idx}",
    "log.uiUpdated": "UI 设备信息更新完成",
    "log.lutOn": "开启",
    "log.lutOff": "关闭",
    "log.lutToggle": "LUT: {state}",
    "log.bleConnectFail": "蓝牙连接失败: {msg}",
    "log.wifiConnected": "WiFi 已连接，IP: {ip}",
    "log.wifiUseSavedIp": "填入上次的 IP: {ip}，设备当前未连接 WiFi，请先点击「连接 WiFi」",
    "log.wifiNotConfigured": "设备未连接 WiFi，请先配置 WiFi",
    "log.ipQueryFailed": "查询 IP 失败，请稍后手动查询",
    "log.deviceConnected": "设备连接成功，已获取设备信息",
    "log.deviceInfoFail": "获取设备信息失败: {msg}",
    "log.wifiCmdFail": "WiFi 指令发送失败: {msg}",
    "log.wifiConnectSuccess": "WiFi 连接成功！IP: {ip}",
    "log.wifiConnectFail": "{msg}",
    "log.bleNotConnectedWarn": "蓝牙未连接",
    "log.wifiScanFail": "WiFi 扫描失败: {msg}，请手动输入 SSID",
    "log.noIpYet": "尚未获取到 IP (当前: {ip})",
    "log.ipResult": "IP: {ip}",
    "log.ipQueryError": "获取 IP 失败: {msg}",
    "log.setModelFail": "型号设置失败: {msg}",
    "log.setNameFail": "自定义名称设置失败: {msg}",
    "log.modeSetSuccess": "工作模式设置成功",
    "log.modeSetFail": "工作模式设置失败: {msg}",
    "log.intervalSetSuccess": "相册间隔设置成功: {minutes} 分钟",
    "log.setIntervalFail": "相册间隔设置失败: {msg}",
    "log.intervalQueryFail": "查询相册间隔失败: {msg}",
    "log.clearScreenFail": "清屏失败: {msg}",
    "log.sendFail": "发送失败: {msg}",
    "log.wifiSendStart": "WiFi 发送开始，{bytes} 字节...",
    "log.wifiProgress": "WiFi 传输进度: {pct}%",
    "log.sendSuccess": "发送成功！耗时 {time}s，回复: {reply}",
    "log.wifiSendFail": "WiFi 发送失败: {msg}",
    "log.binExported": "BIN 文件已导出",
    "log.restoreStart": "开始反向还原: {bytes} 字节 → {w}×{h}",
    "log.restoreSuccess": "图像反向还原成功",
    "log.lutLoaded": "LUT 加载成功 | 大小: {bytes} 字节 | 前18字节: {head}",
    "log.lutLoadFail": "LUT 加载失败: {msg}",
    "log.noDeviceSize": "尚未获取设备尺寸，量化跳过",
    "log.paletteEmpty": "调色板为空，量化跳过",
    "log.textEditorNotReady": "文字编辑预览尚未就绪",
    "log.quantizeDone": "量化完成，输出 {bytes} 字节",
    "log.textAddError": "添加文字错误: {msg}",
    "log.canvasRenderError": "Canvas 渲染错误: {msg}",
    "log.bleAllChannelsReady": "BLE 全部通道就绪 (TX / RX / STS)",
    "log.bleTxUnavailable": "BLE 未连接，TX 特征值不可用",
    "log.bleRxUnavailable": "BLE 未连接，RX 特征值不可用",
    "log.bleTimeout": "超时: {label} ({ms}ms)",
    "log.bleDisconnected": "蓝牙连接意外断开！",
    "log.bleNotSupported": "Web Bluetooth API 不可用，请启用 Experimental Web Platform features。",
    "log.cmdSendInfo": "发送 CMD_REPORT_EPD_INFO...",
    "log.cmdReadInfo": "读取设备信息，共 {bytes} 字节: {hex}",
    "log.cmdInfoJson": "设备信息 JSON:",
    "log.cmdSendWifi": "发送 WiFi 配置: SSID=\"{ssid}\" (共 {len} 字节)",
    "log.cmdWifiDone": "WiFi 指令发送完成",
    "log.cmdIpResult": "IP 查询结果: \"{ip}\"",
    "log.cmdWifiIpConnected": "WiFi 已连接，IP: {ip}",
    "log.cmdWifiScanReq": "请求 WiFi 扫描...",
    "log.cmdWifiScanDone": "扫描完成，发现 {count} 个网络",
    "log.cmdSetModel": "发送型号设置: \"{name}\" ({len} 字节)",
    "log.cmdSetModelSent": "型号指令已送达，等待硬件确认...",
    "log.cmdSetCustomName": "发送自定义名称: \"{name}\" ({len} 字节)",
    "log.cmdSetCustomNameSent": "自定义名称指令已送达",
    "log.cmdSetMode": "发送工作模式: {mode} (0x{hex})",
    "log.cmdSetModeDone": "工作模式设置完成",
    "log.cmdSetAlbumInterval": "发送相册间隔: {minutes} 分钟",
    "log.cmdSetAlbumIntervalDone": "相册间隔设置完成",
    "log.cmdGetAlbumInterval": "当前相册间隔: {minutes} 分钟",
    "log.cmdClearScreen": "发送清屏指令: CMD=0x06, ColorIndex={idx}",
    "log.cmdClearScreenDone": "清屏指令发送完成",
    "log.cmdBleTransfer": "开始 BLE 图像传输: {bytes} 字节，{pkts} 包，每包 {chunk} 字节数据",
    "log.cmdStartFrame": "发送开始帧: 总大小 {bytes} 字节",
    "log.cmdProgress": "进度: {pct}% ({cur}/{total})",
    "log.cmdEndFrame": "发送结束帧",
    "log.cmdBleTransferDone": "BLE 图像传输完成",
    "error.emptyData": "读取到空数据，可能是新设备，需要先设置型号",
    "error.wifiTimeout": "WiFi 连接超时，请检查 SSID 和密码是否正确",
    "error.wifiScanTimeout": "WiFi 扫描超时",
    "notify.modelSetOk": "硬件反馈: 型号设置成功，已保存到 NVS",
    "notify.modelSetFail": "硬件反馈: 型号设置失败（型号无效）",
    "notify.unknownCode": "收到未知状态码: 0x{code}",
    "tour.step1": "点击「蓝牙」按钮，扫描并连接您的 EPD 设备。连接成功后会自动获取设备信息。",
    "tour.step2": "连接设备后，打开你手机系统的热点设置界面, 设置好ssid和密码后 启动你手机的热点功能, 把你设置热点的ssid和密码, 输入到本网页的wifi连接设置里面的对应位置, 最后点击本网页的连接wifi按钮",
    "tour.step3": "点击「选择图片」上传您想要显示在电子纸上的图片。您可以在裁剪步骤中翻转和旋转图片。",
    "tour.step4": "点击「下一步」进入文字编辑步骤。您可以在此步骤中为图片添加文字、拖拽位置和自定义颜色。",
    "tour.step5": "再次点击「下一步」进入量化步骤。您可以调整图片的亮度和对比度，并启用色彩增强（LUT）。",
    "tour.step6": "最后，点击「蓝牙发送」或「WiFi 发送」将处理好的图片传输到您的 EPD 设备上显示。",
    "wifi.scanning": "扫描中...",
    "wifi.scanningHotspots": "正在扫描 WiFi 热点...",
    "wifi.foundNetworks": "找到 {count} 个网络",
    "wifi.noNetworks": "未扫描到 WiFi 网络（隐藏 SSID 请手动输入）",
    "wifi.scanFailed": "扫描失败，请手动输入 SSID 和密码",
    "wifi.scanFailStatus": "扫描失败",
    "wifi.selected": "已选择: {ssid}",
    "overlay.connectingWifi": "正在连接 WiFi...",
    "overlay.wifiSuccess": "WiFi 连接成功！IP: {ip}",
    "overlay.wifiFail": "WiFi 连接失败",
    "overlay.syncSuccess": "同步成功",
    "overlay.bleError": "蓝牙异常",
    "overlay.wifiError": "WiFi 异常",
    "overlay.persisting": "正在持久化...",
    "overlay.saved": "已保存: {ts}",
    "overlay.formatting": "正在格式化/清空...",
    "overlay.clearScheduled": "刷屏中，清空任务已排队...",
    "overlay.flashCleared": "Flash 已清空"
  };

  let _locale = {};
  let _currentLang = 'zh';

  function t(key, vars) {
    let text = _locale[key];
    if (text === undefined) text = FALLBACK[key];
    if (text === undefined) return key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
      }
    }
    return text;
  }

  function refresh() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      if (el.tagName === 'OPTION') {
        el.textContent = t(el.dataset.i18n);
      } else {
        el.textContent = t(el.dataset.i18n);
      }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.dataset.i18nTitle);
    });
    document.querySelectorAll('[data-i18n-alt]').forEach(el => {
      el.alt = t(el.dataset.i18nAlt);
    });
    document.querySelectorAll('[data-i18n-value]').forEach(el => {
      el.value = t(el.dataset.i18nValue);
    });
    if (_locale['page.title'] || FALLBACK['page.title']) {
      document.title = t('page.title');
    }
  }

  function detectLang() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
    const navLang = (navigator.language || '').toLowerCase();
    if (navLang.startsWith('zh')) return 'zh';
    return 'en';
  }

  async function init(lang) {
    if (!lang) lang = detectLang();
    _currentLang = lang;
    try {
      const res = await fetch(`locales/${lang}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      _locale = await res.json();
    } catch {
      _locale = {};
    }
    refresh();
    localStorage.setItem(STORAGE_KEY, lang);
    const switcher = document.getElementById('langSwitcher');
    if (switcher) switcher.value = lang;
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }

  window.I18n = { t, init, refresh, get currentLang() { return _currentLang; } };

})();
