(function(App) {

  function updateBleStatus(status, deviceName) {
    const dot = document.querySelector('.status-btn[data-target="window1"] .status-dot');
    const text = document.querySelector('.status-btn[data-target="window1"] .status-text');
    const deviceLabel = document.getElementById('bleDeviceLabel');
    if (!dot || !text) return;
    dot.classList.remove('connected', 'connecting');
    const map = {
      connecting:    ['connecting', '连接中'],
      connected:     ['connected',  '已连接'],
      disconnected:  [null,        '蓝牙'],
      error:         [null,        '蓝牙'],
    };
    const [cls, label] = map[status] || [null, '蓝牙'];
    if (cls) dot.classList.add(cls);
    text.textContent = label;

    const btn = document.querySelector('.status-btn[data-target="window1"]');
    if (btn) btn.classList.toggle('connected', status === 'connected');

    if (status === 'connected' && deviceName && deviceLabel) {
      deviceLabel.textContent = deviceName;
    } else if (status === 'disconnected' && deviceLabel) {
      deviceLabel.textContent = '扫描蓝牙设备';
    }
  }

  function updateWifiStatus(status, ip) {
    const dot = document.querySelector('.status-btn[data-target="window2"] .status-dot');
    const text = document.querySelector('.status-btn[data-target="window2"] .status-text');
    if (!dot || !text) return;
    dot.classList.remove('connected', 'connecting');
    const map = {
      connecting:    ['connecting', '连接中'],
      connected:     ['connected',  '已连接'],
      disconnected:  [null,        'WiFi'],
      error:         [null,        'WiFi'],
    };
    const [cls, label] = map[status] || [null, 'WiFi'];
    if (cls) dot.classList.add(cls);
    text.textContent = label;

    const btn = document.querySelector('.status-btn[data-target="window2"]');
    if (btn) btn.classList.toggle('connected', status === 'connected');
  }

  function applyDeviceInfoToUI(info) {
    document.getElementById('modelGet').value = info.name;
    document.getElementById('width').value = info.width;
    document.getElementById('height').value = info.height;
    document.getElementById('BPP').value = info.bpp;
    App.state.devicePalette = info.palette;

    const label = document.getElementById('cropDimLabel');
    if (label) {
      label.textContent = info.width && info.height
        ? `屏幕尺寸: ${info.width} × ${info.height} px`
        : '— 请先连接设备以获取屏幕尺寸 —';
    }

    const pc = document.getElementById('paletteContainer');
    if (pc && info.palette.length) {
      pc.innerHTML = '';
      info.palette.forEach((rgb, idx) => {
        const box = document.createElement('div');
        box.className = 'palette-item';
        box.style.backgroundColor = `rgb(${rgb.join(',')})`;
        box.dataset.index = idx;
        if (idx === App.state.selectedPaletteIndex) box.classList.add('selected');
        box.onclick = () => {
          document.querySelectorAll('.palette-item').forEach(el => el.classList.remove('selected'));
          box.classList.add('selected');
          App.state.selectedPaletteIndex = idx;
          App.log(`已选中调色板颜色索引: ${idx}`);
        };
        pc.appendChild(box);
      });
    }

    if (App.state.cropperInstance) {
      App.refreshCropperAspectRatio(info.width, info.height);
    }

    App.log('✅ UI 设备信息更新完成');
  }

  function toggleAdvancedWindow(show) {
    const win = document.getElementById('advancedWindow');
    if (!win) return;
    if (show === undefined) show = !win.classList.contains('active');
    win.classList.toggle('active', show);
  }

  function toggleLog(show) {
    const body = document.body;
    if (show === undefined) show = body.classList.contains('log-hidden');
    body.classList.toggle('log-hidden', !show);
    const btn = document.getElementById('toggleLogBtn');
    if (btn) btn.textContent = show ? '隐藏' : '显示';
    localStorage.setItem('log_visible', show);
  }

  function bindEvents() {

    document.getElementById('advancedBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAdvancedWindow();
    });
    document.getElementById('closeAdvancedBtn').addEventListener('click', () => toggleAdvancedWindow(false));
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#advancedWindow') && !e.target.closest('#advancedBtn')) {
        toggleAdvancedWindow(false);
      }
    });

    document.getElementById('uploadImageBtn').addEventListener('click', () => {
      document.getElementById('imageInput').click();
    });
    document.getElementById('imageInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const imgEl = document.getElementById('cropperImage');
        if (App.state.cropperInstance) {
          App.state.cropperInstance.destroy();
          App.state.cropperInstance = null;
        }
        imgEl.onload = () => App.initCropper(imgEl);
        imgEl.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('rotateLeft').addEventListener('click', () => {
      if (App.state.cropperInstance) {
        App.state.cropperInstance.rotate(-90);
        App.scheduleQuantize();
      }
    });
    document.getElementById('rotateRight').addEventListener('click', () => {
      if (App.state.cropperInstance) {
        App.state.cropperInstance.rotate(90);
        App.scheduleQuantize();
      }
    });
    document.getElementById('flipHorizontal').addEventListener('click', () => {
      if (App.state.cropperInstance) {
        const data = App.state.cropperInstance.getData();
        App.state.cropperInstance.scaleX(-(data.scaleX || 1));
        App.scheduleQuantize();
      }
    });
    document.getElementById('flipVertical').addEventListener('click', () => {
      if (App.state.cropperInstance) {
        const data = App.state.cropperInstance.getData();
        App.state.cropperInstance.scaleY(-(data.scaleY || 1));
        App.scheduleQuantize();
      }
    });

    document.getElementById('brightness').addEventListener('input', (e) => {
      document.getElementById('brightnessVal').textContent = e.target.value;
      App.scheduleQuantize();
    });
    document.getElementById('contrast').addEventListener('input', (e) => {
      document.getElementById('contrastVal').textContent = e.target.value;
      App.scheduleQuantize();
    });
    document.querySelectorAll('.step-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        input.value = Math.min(100, Math.max(-100, +input.value + +btn.dataset.step));
        input.dispatchEvent(new Event('input'));
      });
    });
    document.getElementById('useLutCheckbox').addEventListener('change', (e) => {
      App.state.useLut = e.target.checked;
      App.log(`LUT: ${App.state.useLut ? '开启' : '关闭'}`);
      App.scheduleQuantize();
    });
    document.getElementById('quantizedImagebtn').addEventListener('click', App.quantizeImage);

    document.getElementById('scanBLEBtn').addEventListener('click', async (event) => {
      event.stopPropagation();
      event.preventDefault();
      if (!BLE.isSupported()) return;

      let serviceUuid = document.querySelector('#service').value;
      if (serviceUuid.startsWith('0x')) serviceUuid = parseInt(serviceUuid);

      const filters = [];
      if (serviceUuid) filters.push({ services: [serviceUuid] });
      const fn = document.querySelector('#name').value;
      if (fn) filters.push({ name: fn });
      const fp = document.querySelector('#namePrefix').value;
      if (fp) filters.push({ namePrefix: fp });

      const scanOptions = document.querySelector('#allDevices').checked
        ? { acceptAllDevices: true }
        : { filters };

      try {
        await BLE.connect(scanOptions, {
          serviceUuid, txUuid: 0xFF05, rxUuid: 0xFF04, statusUuid: 0xFF01,
        });
      } catch (e) {
        App.log(`❌ 蓝牙连接失败: ${e.message}`);
        return;
      }

      try {
        const info = await EPD.getDeviceInfo();
        applyDeviceInfoToUI(info);

        const ipInput = document.getElementById('ipAddress');
        const savedIp = localStorage.getItem('saved_device_ip');
        if (savedIp) ipInput.value = savedIp;

        // 查询设备真实 IP，不信任缓存
        try {
          const realIp = await EPD.getIp(3000);
          if (realIp && realIp !== '0.0.0.0') {
            BLE.state.deviceIp = realIp;
            ipInput.value = realIp;
            localStorage.setItem('saved_device_ip', realIp);
            updateWifiStatus('connected', realIp);
            App.log(`🌐 WiFi 已连接，IP: ${realIp}`);
          } else {
            updateWifiStatus('disconnected');
            if (savedIp) {
              App.log(`🌐 填入上次的 IP: ${savedIp}，设备当前未连接 WiFi，请先点击「连接 WiFi」`);
            } else {
              App.log('🌐 设备未连接 WiFi，请先配置 WiFi');
            }
          }
        } catch {
          updateWifiStatus('disconnected');
          App.log('⚠️ 查询 IP 失败，请稍后手动查询');
        }

        document.getElementById('window1').classList.remove('active');
        App.log('✅ 设备连接成功，已获取设备信息');
      } catch (e) {
        App.log(`❌ 获取设备信息失败: ${e.message}`);
      }
    });

    document.getElementById('setWifiBtn').addEventListener('click', async () => {
      const ssid = document.getElementById('ssid').value;
      const pwd = document.getElementById('password').value;
      if (!ssid || !pwd) { alert('请先输入完整的 SSID 和密码'); return; }
      if (!BLE.state.ch_tx) { alert('蓝牙未连接'); return; }

      localStorage.setItem('saved_ssid', ssid);
      localStorage.setItem('saved_password', pwd);

      try { await EPD.setWifi(ssid, pwd); }
      catch (e) { App.log(`❌ WiFi 指令发送失败: ${e.message}`); return; }

      updateWifiStatus('connecting');
      App.overlay.show();
      App.overlay.update('正在连接 WiFi...');

      try {
        const ip = await EPD.waitForIp(msg => App.overlay.update(msg), 2000, 60000);
        BLE.state.deviceIp = ip;
        document.getElementById('ipAddress').value = ip;
        localStorage.setItem('saved_device_ip', ip);
        App.log(`🌐 WiFi 连接成功！IP: ${ip}`);
        updateWifiStatus('connected', ip);
        document.getElementById('window2').classList.remove('active');
        await App.overlay.complete(`WiFi 连接成功！IP: ${ip}`);
      } catch (e) {
        App.log(`❌ ${e.message}`);
        updateWifiStatus('error');
        await App.overlay.fail('WiFi 连接失败');
      }
    });

    document.getElementById('scanWifiBtn').addEventListener('click', async () => {
      if (!BLE.state.ch_tx) { App.log('⚠️ 蓝牙未连接'); return; }

      const container = document.getElementById('scanResultContainer');
      const list = document.getElementById('scanResultList');
      const status = document.getElementById('scanStatus');
      const btn = document.getElementById('scanWifiBtn');

      btn.disabled = true;
      container.style.display = 'block';
      list.innerHTML = '<div style="padding:12px;text-align:center;color:#999;">扫描中...</div>';
      status.textContent = '正在扫描 WiFi 热点...';

      try {
        const networks = await EPD.scanWifi();
        status.textContent = `找到 ${networks.length} 个网络`;

        if (networks.length === 0) {
          list.innerHTML = '<div style="padding:12px;text-align:center;color:#999;">未扫描到 WiFi 网络（隐藏 SSID 请手动输入）</div>';
          return;
        }

        list.innerHTML = '';
        networks.forEach(net => {
          const div = document.createElement('div');
          div.className = 'scan-item';

          const lock = document.createElement('span');
          lock.className = 'lock-icon';
          lock.textContent = net[2] === 0 ? '🔓' : '🔒';

          const name = document.createElement('span');
          name.className = 'ssid-name';
          name.textContent = net[0];

          const rssi = document.createElement('span');
          rssi.className = 'ssid-rssi';
          const bars = net[1] > -60 ? '📶' : '📶';
          rssi.textContent = `${bars} ${net[1]}dBm`;

          div.appendChild(lock);
          div.appendChild(name);
          div.appendChild(rssi);

          div.addEventListener('click', () => {
            document.querySelectorAll('.scan-item').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            document.getElementById('ssid').value = net[0];
            status.textContent = `已选择: ${net[0]}`;
          });

          list.appendChild(div);
        });
      } catch (e) {
        App.log(`⚠️ WiFi 扫描失败: ${e.message}，请手动输入 SSID`);
        list.innerHTML = '<div style="padding:12px;text-align:center;color:#999;">扫描失败，请手动输入 SSID 和密码</div>';
        status.textContent = '扫描失败';
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('getIPBtn').addEventListener('click', async () => {
      document.getElementById('ipAddress').value = '';
      try {
        const ip = await EPD.getIp(5000);
        if (ip === '0.0.0.0') {
          App.log(`⚠️ 尚未获取到 IP (当前: ${ip})`);
          updateWifiStatus('disconnected');
        } else {
          BLE.state.deviceIp = ip;
          document.getElementById('ipAddress').value = ip;
          App.log(`🌐 IP: ${ip}`);
          updateWifiStatus('connected', ip);
        }
      } catch (e) {
        App.log(`❌ 获取 IP 失败: ${e.message}`);
        updateWifiStatus('error');
      }
    });

    document.getElementById('setdeviceBtn').addEventListener('click', async () => {
      const name = document.getElementById('modelSet').value.trim();
      if (!name) { alert('请先确保型号信息已读取'); return; }
      try { await EPD.setDeviceName(name); }
      catch (e) { App.log(`❌ 型号设置失败: ${e.message}`); }
    });

    document.getElementById('setCustomNameBtn').addEventListener('click', async () => {
      const name = document.getElementById('customName').value.trim();
      if (!name) { alert('请先输入自定义名称'); return; }
      try { await EPD.setCustomName(name); }
      catch (e) { App.log(`❌ 自定义名称设置失败: ${e.message}`); }
    });

    document.getElementById('setModeBtn').addEventListener('click', async () => {
      const mode = parseInt(document.getElementById('woringModeSet').value);
      try { await EPD.setWorkingMode(mode); App.log('✅ 工作模式设置成功'); }
      catch (e) { App.log(`❌ 工作模式设置失败: ${e.message}`); alert(`发送失败: ${e.message}`); }
    });

    document.getElementById('ClearBtn').addEventListener('click', async () => {
      if (!BLE.state.ch_tx) { alert('蓝牙未连接！'); return; }
      try { await EPD.clearScreen(App.state.selectedPaletteIndex); }
      catch (e) { App.log(`❌ 清屏失败: ${e.message}`); }
    });

    document.getElementById('toggleLogBtn').addEventListener('click', () => toggleLog());

    document.getElementById('sendBtnBle').addEventListener('click', async () => {
      if (!App.state.outputData?.length) { alert('请先进行图片量化！'); return; }
      if (!BLE.state.ch_tx) { alert('蓝牙未连接！'); return; }
      App.overlay.show();
      try {
        await EPD.sendImageBle(App.state.outputData, pct => App.overlay.update(pct.toFixed(1)));
        await App.overlay.complete('同步成功');
      } catch (e) {
        App.log(`❌ 发送失败: ${e.message}`);
        await App.overlay.fail('蓝牙异常');
      }
    });

    document.getElementById('sendBtnIP').addEventListener('click', async () => {
      const targetIp = BLE.state.deviceIp;
      if (!targetIp || targetIp === '0.0.0.0') { alert('设备未连接 WiFi，请先连接 WiFi 获取 IP'); return; }
      if (!App.state.outputData?.length) { alert('请先进行图片量化！'); return; }

      const startTime = Date.now();
      App.log(`🚀 WiFi 发送开始，${App.state.outputData.length} 字节...`);
      App.overlay.show();
      App.overlay.update('0%');

      let progressTimer = null;
      if (BLE.state.ch_tx && BLE.state.ch_rx) {
        progressTimer = setInterval(async () => {
          try {
            const pct = await EPD.queryProgress();
            App.log(`📊 WiFi 传输进度: ${pct}%`);
            App.overlay.update(pct.toString());
          } catch (e) { console.warn('查询进度失败:', e); }
        }, 2000);
      }

      try {
        const res = await fetch(`http://${targetIp}/upload_epd`, {
          method: 'POST', body: App.state.outputData,
          headers: { 'Content-Type': 'application/octet-stream' },
          signal: AbortSignal.timeout(300000),
        });
        clearInterval(progressTimer);
        if (res.ok) {
          const txt = await res.text();
          App.log(`✅ 发送成功！耗时 ${((Date.now() - startTime) / 1000).toFixed(2)}s，回复: ${txt}`);
          await App.overlay.complete('同步成功');
        } else {
          throw new Error(`服务器响应错误: ${res.status}`);
        }
      } catch (e) {
        clearInterval(progressTimer);
        App.log(`❌ WiFi 发送失败: ${e.message}`);
        await App.overlay.fail('WiFi 异常');
      }
    });

    document.getElementById('saveToFlashBtn').addEventListener('click', async () => {
      const ip = BLE.state.deviceIp;
      if (!ip || ip === '0.0.0.0') { alert('设备未连接 WiFi，无法持久化'); return; }
      const now = new Date();
      const ts = [now.getFullYear(), now.getMonth() + 1, now.getDate(),
      now.getHours(), now.getMinutes(), now.getSeconds()]
        .map(n => String(n).padStart(2, '0')).join('');
      App.overlay.show(); App.overlay.update('正在持久化...');
      try {
        const res = await fetch(`http://${ip}/save_image?time=${ts}`, { method: 'POST' });
        if (res.ok) { await App.overlay.complete(`已保存: ${ts}`); }
        else { throw new Error('服务器保存失败'); }
      } catch (e) { await App.overlay.fail(e.message); }
    });

    document.getElementById('clearFlashBtn').addEventListener('click', async () => {
      if (!confirm('确定要删除 Flash 中保存的所有图片吗？此操作不可撤销。')) return;
      const ip = BLE.state.deviceIp;
      if (!ip || ip === '0.0.0.0') { alert('设备未连接 WiFi，无法清空'); return; }
      App.overlay.show(); App.overlay.update('正在格式化/清空...');
      try {
        const res = await fetch(`http://${ip}/clear_flash`, { method: 'POST' });
        const text = await res.text();
        if (res.ok) {
          await App.overlay.complete(text.includes('scheduled') ? '刷屏中，清空任务已排队...' : 'Flash 已清空');
        } else { throw new Error('清空失败'); }
      } catch (e) { await App.overlay.fail(e.message); }
    });

    document.getElementById('exportBinBtn').addEventListener('click', () => {
      if (!App.state.outputData?.length) { alert('请先进行图片量化！'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([App.state.outputData], { type: 'application/octet-stream' }));
      a.download = `image_${document.getElementById('width').value}x${document.getElementById('height').value}.bin`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 0);
      App.log('✅ BIN 文件已导出');
    });

    document.getElementById('importBinBtn').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const importedData = new Uint8Array(await file.arrayBuffer());
      const w = parseInt(document.getElementById('width').value);
      const h = parseInt(document.getElementById('height').value);
      const cc = App.state.devicePalette.length;

      if (!w || !h || cc === 0) {
        alert('请先确保设备信息已读取（宽/高/调色板）'); return;
      }
      App.log(`开始反向还原: ${importedData.length} 字节 → ${w}×${h}`);

      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      const imageData = ctx.createImageData(w, h);
      const rgba = imageData.data;

      for (let i = 0; i < w * h; i++) {
        let pi = 0;
        if (cc <= 2) {
          pi = (importedData[Math.floor(i / 8)] >> (7 - i % 8)) & 0x01;
        } else if (cc <= 4) {
          pi = (importedData[Math.floor(i / 4)] >> ((3 - i % 4) * 2)) & 0x03;
          if (cc === 3 && pi === 3) pi = 2;
        } else {
          pi = (importedData[Math.floor(i / 2)] >> ((1 - i % 2) * 4)) & 0x0F;
        }
        const rgb = App.state.devicePalette[pi] || [0, 0, 0];
        const off = i * 4;
        rgba[off] = rgb[0]; rgba[off + 1] = rgb[1]; rgba[off + 2] = rgb[2]; rgba[off + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);
      const qImg = document.getElementById('quantizedImage');
      qImg.src = canvas.toDataURL();
      qImg.style.display = 'block';
      const qph = document.getElementById('quantizedPlaceholder');
      if (qph) qph.style.display = 'none';
      App.log('✅ 图像反向还原成功');
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    BLE.init({
      log: App.log,
      onStatusChange: updateBleStatus,
      onNotification: (event) => {
        const r = EPD.handleNotification(event);
        App.log(r.message);
      },
    });
    EPD.init({ log: App.log });

    const modelSelect = document.getElementById('modelSet');
    EPD.MODEL_LIST.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name; opt.textContent = name;
      modelSelect.appendChild(opt);
    });

    const savedSSID = localStorage.getItem('saved_ssid');
    const savedPass = localStorage.getItem('saved_password');
    if (savedSSID) document.getElementById('ssid').value = savedSSID;
    if (savedPass) document.getElementById('password').value = savedPass;

    updateBleStatus('disconnected');
    App.loadLUT();
    App.textEdit.init();
    App.initWizard();
    App.initTour();
    bindEvents();

    const logVisible = localStorage.getItem('log_visible') === 'true';
    if (!logVisible) toggleLog(false);

    const statusBtns = document.querySelectorAll('.status-btn');
    const statusWindows = document.querySelectorAll('.status-window');

    statusBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const targetWindow = document.getElementById(targetId);
        if (!targetWindow) return;
        const isActive = targetWindow.classList.contains('active');
        statusWindows.forEach(window => window.classList.remove('active'));
        if (!isActive) targetWindow.classList.add('active');
      });
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.status-btn') && !e.target.closest('.status-window')) {
        statusWindows.forEach(window => window.classList.remove('active'));
      }
    });
  });

})(window.App = window.App || {});
