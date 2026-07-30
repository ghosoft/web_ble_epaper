(function(App) {

  const tourSteps = [
    { target: '.status-btn[data-target="window1"]', key: 'tour.step1', placement: 'bottom' },
    { target: '.status-btn[data-target="window2"]', key: 'tour.step2', placement: 'bottom' },
    { target: '#uploadImageBtn', key: 'tour.step3', placement: 'top' },
    { target: '#nextStepBtn', key: 'tour.step4', placement: 'left' },
    { target: '#nextStepBtn', key: 'tour.step5', placement: 'right' },
    { target: '#sendArea', key: 'tour.step6', placement: 'top' },
  ];

  let tourActive = false;
  let tourCurrentStep = 0;

  function tourStart() {
    tourActive = true;
    tourCurrentStep = 0;
    document.getElementById('tourOverlay').style.display = 'block';
    document.getElementById('tourTotalSteps').textContent = tourSteps.length;
    document.querySelectorAll('.status-window').forEach(w => w.classList.remove('active'));
    tourGoToStep(0);
  }

  function tourEnd() {
    tourActive = false;
    document.getElementById('tourOverlay').style.display = 'none';
  }

  function tourPositionHighlight(el) {
    const rect = el.getBoundingClientRect();
    const pad = 8;
    const hl = document.getElementById('tourHighlight');
    hl.style.left = (rect.left - pad) + 'px';
    hl.style.top = (rect.top - pad) + 'px';
    hl.style.width = (rect.width + pad * 2) + 'px';
    hl.style.height = (rect.height + pad * 2) + 'px';
  }

  function tourPositionTooltip(el, preferred) {
    const gap = 14, sg = 8, pad = 8;
    const tRect = el.getBoundingClientRect();
    const hRect = {
      left: tRect.left - pad, top: tRect.top - pad,
      right: tRect.right + pad, bottom: tRect.bottom + pad,
    };
    const tooltip = document.getElementById('tourTooltip');

    tooltip.style.left = '-9999px';
    tooltip.style.top = '-9999px';
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;

    const order = { top: ['top', 'bottom', 'left', 'right'], bottom: ['bottom', 'top', 'left', 'right'], left: ['left', 'right', 'top', 'bottom'], right: ['right', 'left', 'top', 'bottom'] };
    const candidates = order[preferred] || ['bottom', 'top', 'left', 'right'];
    let best = null, bestOverlap = Infinity;

    for (const p of candidates) {
      let left, top;
      if (p === 'bottom') { left = tRect.left + tRect.width / 2 - tw / 2; top = tRect.bottom + gap; }
      else if (p === 'top') { left = tRect.left + tRect.width / 2 - tw / 2; top = tRect.top - th - gap; }
      else if (p === 'left') { left = tRect.left - tw - gap; top = tRect.top + tRect.height / 2 - th / 2; }
      else { left = tRect.right + gap; top = tRect.top + tRect.height / 2 - th / 2; }
      left = Math.max(sg, Math.min(left, window.innerWidth - tw - sg));
      top = Math.max(sg, Math.min(top, window.innerHeight - th - sg));

      const tipRect = { left, top, right: left + tw, bottom: top + th };
      const xOverlap = Math.max(0, Math.min(tipRect.right, hRect.right) - Math.max(tipRect.left, hRect.left));
      const yOverlap = Math.max(0, Math.min(tipRect.bottom, hRect.bottom) - Math.max(tipRect.top, hRect.top));
      const overlap = xOverlap * yOverlap;

      if (overlap === 0) { tooltip.style.left = left + 'px'; tooltip.style.top = top + 'px'; return; }
      if (overlap < bestOverlap) { bestOverlap = overlap; best = { left, top }; }
    }
    if (best) { tooltip.style.left = best.left + 'px'; tooltip.style.top = best.top + 'px'; }
  }

  function tourGoToStep(idx) {
    if (idx < 0 || idx >= tourSteps.length) return;
    tourCurrentStep = idx;
    const step = tourSteps[idx];
    const targetEl = document.querySelector(step.target);
    if (!targetEl) { tourEnd(); return; }

    document.getElementById('tourStepNum').textContent = idx + 1;
    document.getElementById('tourText').textContent = I18n.t(step.key);

    const isFirst = idx === 0;
    const isLast = idx === tourSteps.length - 1;

    document.getElementById('tourPrevBtn').style.display = isFirst ? 'none' : '';
    document.getElementById('tourNextBtn').style.display = isLast ? 'none' : '';
    document.getElementById('tourFinishBtn').style.display = isLast ? '' : 'none';

    targetEl.scrollIntoView({ block: 'center' });
    tourPositionHighlight(targetEl);
    tourPositionTooltip(targetEl, step.placement);
  }

  function tourNext() { tourGoToStep(tourCurrentStep + 1); }
  function tourPrev() { tourGoToStep(tourCurrentStep - 1); }

  App.initTour = function() {
    document.getElementById('tourNextBtn').addEventListener('click', tourNext);
    document.getElementById('tourPrevBtn').addEventListener('click', tourPrev);
    document.getElementById('tourFinishBtn').addEventListener('click', tourEnd);
    document.getElementById('tourSkipBtn').addEventListener('click', tourEnd);
    document.getElementById('tourCloseBtn').addEventListener('click', tourEnd);

    document.getElementById('guideBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (tourActive) { tourEnd(); return; }
      tourStart();
    });

    let tourResizeTimer;
    window.addEventListener('resize', () => {
      if (!tourActive) return;
      clearTimeout(tourResizeTimer);
      tourResizeTimer = setTimeout(() => {
        const step = tourSteps[tourCurrentStep];
        const el = document.querySelector(step.target);
        if (el) { tourPositionHighlight(el); tourPositionTooltip(el, step.placement); }
      }, 150);
    });
  };

})(window.App = window.App || {});
