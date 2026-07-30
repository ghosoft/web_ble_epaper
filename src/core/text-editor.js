(function(App) {

  App.textEdit = {
    items: [],
    selectedId: null,
    nextId: 1,
    baseImage: null,
    dragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    scaleX: 1,
    scaleY: 1,

    get canvas() { return document.getElementById('textEditCanvas'); },
    get ctx() { return this.canvas.getContext('2d'); },
    get box() { return document.getElementById('textEditBox'); },

    init() {
      const c = this.canvas;
      const box = this.box;
      const rect = box.getBoundingClientRect();
      c.width = rect.width;
      c.height = rect.height;

      c.addEventListener('mousedown', e => this._onPointerDown(e));
      c.addEventListener('mousemove', e => this._onPointerMove(e));
      c.addEventListener('mouseup', () => this._onPointerUp());
      c.addEventListener('mouseleave', () => this._onPointerUp());
      c.addEventListener('touchstart', e => { e.preventDefault(); this._onPointerDown(e.touches[0]); }, { passive: false });
      c.addEventListener('touchmove', e => { e.preventDefault(); this._onPointerMove(e.touches[0]); }, { passive: false });
      c.addEventListener('touchend', () => this._onPointerUp());

      document.getElementById('addTextBtn').addEventListener('click', () => this._addText());
      document.getElementById('deleteTextBtn').addEventListener('click', () => this._deleteSelected());
      document.getElementById('textFontSize').addEventListener('input', e => {
        document.getElementById('textFontSizeVal').textContent = e.target.value;
        if (this.selectedId !== null) {
          const item = this.items.find(t => t.id === this.selectedId);
          if (item) { item.fontSize = parseInt(e.target.value); this.render(); }
        }
      });
      document.getElementById('textColorPicker').addEventListener('input', e => {
        if (this.selectedId !== null) {
          const item = this.items.find(t => t.id === this.selectedId);
          if (item) { item.color = e.target.value; this.render(); }
        }
      });

      const ro = new ResizeObserver(() => this._resizeCanvas());
      ro.observe(box);
    },

    _resizeCanvas() {
      const c = this.canvas;
      const box = this.box;
      const rect = box.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      c.width = rect.width;
      c.height = rect.height;
      this.render();
    },

    _addText() {
      try {
        const input = document.getElementById('textInput');
        const text = input.value.trim();
        if (!text) { alert(I18n.t('alert.enterText')); return; }
        const fontSize = parseInt(document.getElementById('textFontSize').value);
        const color = document.getElementById('textColorPicker').value;
        const c = this.canvas;

        this.items.push({
          id: this.nextId++,
          text,
          x: c.width / 2,
          y: c.height / 2,
          fontSize,
          color,
        });
        this.selectedId = this.items[this.items.length - 1].id;

        input.value = '';
        this._showCanvas();
        this.render();
      } catch (err) {
        App.log(I18n.t('log.textAddError', { msg: err.message }));
      }
    },

    _deleteSelected() {
      if (this.selectedId === null) return;
      this.items = this.items.filter(t => t.id !== this.selectedId);
      this.selectedId = null;
      this.render();
    },

    _hitTest(px, py) {
      const ctx = this.ctx;
      for (let i = this.items.length - 1; i >= 0; i--) {
        const t = this.items[i];
        ctx.font = `bold ${t.fontSize}px sans-serif`;
        const m = ctx.measureText(t.text);
        const tw = m.width;
        const th = t.fontSize;
        const left = t.x - tw / 2;
        const top = t.y - th / 2;
        if (px >= left && px <= left + tw && py >= top && py <= top + th) {
          return t;
        }
      }
      return null;
    },

    _getPos(e) {
      const rect = this.canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },

    _onPointerDown(e) {
      const pos = this._getPos(e);
      const hit = this._hitTest(pos.x, pos.y);
      if (hit) {
        this.selectedId = hit.id;
        this.dragging = true;
        this.dragOffsetX = pos.x - hit.x;
        this.dragOffsetY = pos.y - hit.y;
        document.getElementById('textFontSize').value = hit.fontSize;
        document.getElementById('textFontSizeVal').textContent = hit.fontSize;
        document.getElementById('textColorPicker').value = hit.color;
      } else {
        this.selectedId = null;
      }
      this.render();
    },

    _onPointerMove(e) {
      if (!this.dragging || this.selectedId === null) return;
      const pos = this._getPos(e);
      const item = this.items.find(t => t.id === this.selectedId);
      if (item) {
        item.x = pos.x - this.dragOffsetX;
        item.y = pos.y - this.dragOffsetY;
        this.render();
      }
    },

    _onPointerUp() {
      if (this.dragging) {
        this.dragging = false;
      }
    },

    _showCanvas() {
      this.canvas.style.display = 'block';
      const ph = document.getElementById('textEditPlaceholder');
      if (ph) ph.style.display = 'none';
    },

    updateBaseImage() {
      if (!App.state.cropperInstance) return;
      const targetW = parseInt(document.getElementById('width').value);
      const targetH = parseInt(document.getElementById('height').value);
      if (!targetW || !targetH || targetW <= 0 || targetH <= 0) return;

      const croppedCanvas = App.state.cropperInstance.getCroppedCanvas({
        width: targetW,
        height: targetH,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      });
      if (!croppedCanvas || croppedCanvas.width <= 0 || croppedCanvas.height <= 0) return;

      this.baseImage = croppedCanvas;
      this._showCanvas();
      this.render();
    },

    render() {
      try {
        const c = this.canvas;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, c.width, c.height);

        if (this.baseImage && this.baseImage.width > 0 && this.baseImage.height > 0) {
          const imgRatio = this.baseImage.width / this.baseImage.height;
          const boxRatio = c.width / c.height;
          let dw, dh, dx, dy;
          if (imgRatio > boxRatio) {
            dw = c.width; dh = c.width / imgRatio;
          } else {
            dh = c.height; dw = c.height * imgRatio;
          }
          dx = (c.width - dw) / 2;
          dy = (c.height - dh) / 2;
          ctx.drawImage(this.baseImage, dx, dy, dw, dh);
          this.scaleX = this.baseImage.width / dw;
          this.scaleY = this.baseImage.height / dh;
        }

        this.items.forEach(t => {
          ctx.font = `bold ${t.fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = t.color;
          ctx.fillText(t.text, t.x, t.y);

          if (t.id === this.selectedId) {
            const m = ctx.measureText(t.text);
            const tw = m.width;
            const th = t.fontSize;
            ctx.strokeStyle = '#00bfff';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(t.x - tw / 2 - 4, t.y - th / 2 - 4, tw + 8, th + 8);
            ctx.setLineDash([]);
          }
        });
      } catch (err) {
        App.log(I18n.t('log.canvasRenderError', { msg: err.message }));
        try {
          const c = this.canvas;
          const ctx = this.ctx;
          ctx.clearRect(0, 0, c.width, c.height);
        } catch (_) {}
      }
    },

    getCompositedCanvas() {
      const targetW = parseInt(document.getElementById('width').value);
      const targetH = parseInt(document.getElementById('height').value);
      if (!targetW || !targetH) return null;

      const offscreen = document.createElement('canvas');
      offscreen.width = targetW;
      offscreen.height = targetH;
      const ctx = offscreen.getContext('2d');

      if (this.baseImage && this.baseImage.width > 0 && this.baseImage.height > 0) {
        ctx.drawImage(this.baseImage, 0, 0, targetW, targetH);
      }

      const c = this.canvas;
      if (this.baseImage && this.baseImage.width > 0 && this.baseImage.height > 0) {
        const imgRatio = this.baseImage.width / this.baseImage.height;
        const boxRatio = c.width / c.height;
        let dw, dh, dx, dy;
        if (imgRatio > boxRatio) {
          dw = c.width; dh = c.width / imgRatio;
        } else {
          dh = c.height; dw = c.height * imgRatio;
        }
        dx = (c.width - dw) / 2;
        dy = (c.height - dh) / 2;

        this.items.forEach(t => {
          const relX = (t.x - dx) / dw;
          const relY = (t.y - dy) / dh;
          const px = relX * targetW;
          const py = relY * targetH;
          const scaledFontSize = Math.round(t.fontSize * (targetW / dw));
          ctx.font = `bold ${scaledFontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = t.color;
          ctx.fillText(t.text, px, py);
        });
      }

      return offscreen;
    },
  };

})(window.App = window.App || {});
