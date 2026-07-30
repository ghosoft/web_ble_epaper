(function(App) {

  App.loadLUT = async function() {
    try {
      const res = await fetch('lut/Spectra6_Render_LUT_Default_v2.bin');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      App.state.LUT_DATA = await res.arrayBuffer();
      const bytes = new Uint8Array(App.state.LUT_DATA);
      const head = Array.from(bytes.slice(0, 18)).map(b => b.toString(16).padStart(2, '0')).join(' ');
      App.log(I18n.t('log.lutLoaded', { bytes: App.state.LUT_DATA.byteLength, head }));
    } catch (err) {
      App.log(I18n.t('log.lutLoadFail', { msg: err.message }));
    }
  };

  async function quantizeImage() {
    if (!App.state.cropperInstance) return;

    App.textEdit.updateBaseImage();

    const targetW = parseInt(document.getElementById('width').value);
    const targetH = parseInt(document.getElementById('height').value);

    if (!targetW || !targetH) {
      App.log(I18n.t('log.noDeviceSize'));
      return;
    }
    if (App.state.devicePalette.length === 0) {
      App.log(I18n.t('log.paletteEmpty'));
      return;
    }

    App.overlay.show();
    App.overlay.update(I18n.t('overlay.processing'));
    await new Promise(r => setTimeout(r, 0));

    const qBox = document.getElementById('quantizedBox');
    qBox.classList.add('updating');

    const compositedCanvas = App.textEdit.getCompositedCanvas();
    if (!compositedCanvas) {
      App.log(I18n.t('log.textEditorNotReady'));
      qBox.classList.remove('updating');
      return;
    }

    const ctx = compositedCanvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, targetW, targetH);
    const data = imageData.data;

    const brightness = parseInt(document.getElementById('brightness').value);
    const contrast = parseInt(document.getElementById('contrast').value);
    if (brightness !== 0 || contrast !== 0) {
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      for (let i = 0; i < data.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          let v = data[i + c] + brightness;
          v = factor * (v - 128) + 128;
          data[i + c] = Math.min(255, Math.max(0, Math.round(v)));
        }
      }
    }

    if (App.state.useLut && App.state.LUT_DATA) {
      const gLut = new Uint8Array(App.state.LUT_DATA, 0x12);
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const idx = ((b >> 2) + ((g & 0xFC) << 4) + ((r & 0xFC) << 10)) * 3;
        data[i] = gLut[idx + 2];
        data[i + 1] = gLut[idx + 1];
        data[i + 2] = gLut[idx + 0];
      }
    }

    const rq = new RgbQuant({
      colors: App.state.devicePalette.length,
      palette: App.state.devicePalette,
      reIndex: false,
      method: 1,
      dithKern: 'Stucki',
      dithDelta: 0,
      dithSerp: true,
      useCache: false,
    });

    const indexData = rq.reduce(imageData, 2);
    const pixelCount = targetW * targetH;
    const colorCount = App.state.devicePalette.length;
    let packedData;

    if (colorCount <= 2) {
      packedData = new Uint8Array(Math.ceil(pixelCount / 8));
      for (let i = 0; i < pixelCount; i++) {
        packedData[Math.floor(i / 8)] |= ((indexData[i] & 1) << (7 - i % 8));
      }
    } else if (colorCount <= 4) {
      const stride = targetW / 4;
      packedData = new Uint8Array(stride * targetH);
      for (let y = 0; y < targetH; y++) {
        for (let x = 0; x < targetW; x++) {
          let val = (indexData[y * targetW + x] ?? 0) & 0x03;
          if (colorCount === 3 && val === 2) val = 3;
          const byteIdx = y * stride + Math.floor(x / 4);
          const bitShift = (3 - (x % 4)) * 2;
          if (x % 4 === 0) packedData[byteIdx] = 0;
          packedData[byteIdx] |= (val << bitShift);
        }
      }
    } else {
      packedData = new Uint8Array(Math.ceil(pixelCount / 2));
      for (let i = 0; i < pixelCount; i++) {
        packedData[Math.floor(i / 2)] |= ((indexData[i] & 0x0F) << ((1 - i % 2) * 4));
      }
    }

    App.state.outputData = packedData;
    App.log(I18n.t('log.quantizeDone', { bytes: App.state.outputData.length }));

    const visualData = rq.reduce(imageData);
    imageData.data.set(visualData);
    ctx.putImageData(imageData, 0, 0);

    const qImg = document.getElementById('quantizedImage');
    qImg.src = compositedCanvas.toDataURL();
    qImg.style.display = 'block';

    const qph = document.getElementById('quantizedPlaceholder');
    if (qph) qph.style.display = 'none';

    qBox.classList.remove('updating');
    App.overlay.done();
  }

  App.quantizeImage = quantizeImage;
  App.registerQuantizeFn(quantizeImage);

  App.calcCropBoxData = function(containerW, deviceW, deviceH) {
    const S = containerW;
    const target = S * 0.9;
    let cropW, cropH;
    if (deviceW >= deviceH) {
      cropW = target;
      cropH = target * (deviceH / deviceW);
    } else {
      cropH = target;
      cropW = target * (deviceW / deviceH);
    }
    return { width: cropW, height: cropH, left: (S - cropW) / 2, top: (S - cropH) / 2 };
  };

  App.initCropper = function(imgEl) {
    if (App.state.cropperInstance) {
      App.state.cropperInstance.destroy();
      App.state.cropperInstance = null;
    }

    const deviceW = parseInt(document.getElementById('width').value) || 0;
    const deviceH = parseInt(document.getElementById('height').value) || 0;
    const hasSize = deviceW > 0 && deviceH > 0;

    App.state.cropperInstance = new Cropper(imgEl, {
      viewMode: 1,
      dragMode: 'move',
      aspectRatio: hasSize ? deviceW / deviceH : NaN,
      autoCropArea: 0.9,
      movable: true,
      zoomable: true,
      rotatable: true,
      scalable: true,
      cropBoxMovable: false,
      cropBoxResizable: false,
      guides: true,
      center: true,
      highlight: true,
      background: true,

      ready() {
        if (hasSize) {
          const container = App.state.cropperInstance.getContainerData();
          App.state.cropperInstance.setCropBoxData(
            App.calcCropBoxData(container.width, deviceW, deviceH)
          );
        }
      },

    });

    imgEl.style.display = 'block';
    const ph = document.getElementById('cropperPlaceholder');
    if (ph) ph.style.display = 'none';
  };

  App.refreshCropperAspectRatio = function(deviceW, deviceH) {
    if (!App.state.cropperInstance) return;
    const ratio = deviceW > 0 && deviceH > 0 ? deviceW / deviceH : NaN;
    App.state.cropperInstance.setAspectRatio(ratio);

    if (deviceW > 0 && deviceH > 0) {
      const container = App.state.cropperInstance.getContainerData();
      App.state.cropperInstance.setCropBoxData(
        App.calcCropBoxData(container.width, deviceW, deviceH)
      );
    }
  };

})(window.App = window.App || {});
