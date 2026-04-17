const otpInputs = document.querySelectorAll('.otp-input');

function otpNext(el, idx) {
  if (el.value.length === 1 && idx < otpInputs.length - 1) {
    otpInputs[idx + 1].focus();
  }
}
