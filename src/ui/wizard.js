(function(App) {

  let currentStep = 1;
  const totalSteps = 3;

  function updateNextBtnLabel() {
    const btn = document.getElementById('nextStepBtn');
    const lbl = document.getElementById('nextLabel');
    if (currentStep === totalSteps) {
      btn.style.backgroundColor = '#28a745';
      btn.style.color = '#fff';
      lbl.textContent = I18n.t('btn.send');
      lbl.className = 'nav-label active';
    } else {
      btn.style.backgroundColor = '';
      btn.style.color = '';
      lbl.textContent = I18n.t('btn.nextStep');
      lbl.className = 'nav-label';
    }
  }

  function goToStep(step) {
    if (step < 1 || step > totalSteps) return;
    currentStep = step;

    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('step' + step).classList.add('active');

    document.querySelectorAll('.step-dot').forEach(dot => {
      const s = parseInt(dot.dataset.step);
      dot.classList.remove('active', 'done');
      if (s === step) dot.classList.add('active');
      else if (s < step) dot.classList.add('done');
    });
    document.querySelectorAll('.step-line').forEach((line, idx) => {
      const lineStep = idx + 1;
      line.classList.remove('active', 'done');
      if (lineStep < step) line.classList.add('done');
      else if (lineStep === step) line.classList.add('active');
    });
    document.querySelectorAll('.nav-label[data-s]').forEach(span => {
      const s = parseInt(span.dataset.s);
      span.classList.remove('active', 'done');
      if (s === step) span.classList.add('active');
      else if (s < step) span.classList.add('done');
    });

    document.getElementById('prevStepBtn').disabled = step <= 1;
    document.getElementById('nextStepBtn').disabled = false;
    updateNextBtnLabel();

    if (step === 2) {
      App.textEdit.updateBaseImage();
      setTimeout(() => App.textEdit._resizeCanvas(), 50);
    }
    if (step === 3) {
      if (App.state.outputData) {
        App.state.outputData = null;
        const qImg = document.getElementById('quantizedImage');
        qImg.style.display = 'none';
        qImg.src = '';
        const qph = document.getElementById('quantizedPlaceholder');
        if (qph) qph.style.display = '';
      }
      App.quantizeImage();
    }
  }

  App.initWizard = function() {
    document.querySelectorAll('.step-dot').forEach(dot => {
      dot.addEventListener('click', () => goToStep(parseInt(dot.dataset.step)));
    });

    document.getElementById('nextStepBtn').addEventListener('click', () => {
      if (currentStep === totalSteps) {
        document.getElementById('sendBtnIP').click();
      } else {
        goToStep(currentStep + 1);
      }
    });
    document.getElementById('prevStepBtn').addEventListener('click', () => goToStep(currentStep - 1));

    goToStep(1);
  };

})(window.App = window.App || {});
