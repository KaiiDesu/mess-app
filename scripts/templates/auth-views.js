window.ZapTemplateParts = window.ZapTemplateParts || {};
window.ZapTemplateParts.authViews = String.raw`
<!-- ==================== LOGIN SCREEN ==================== -->
    <div class="view" id="view-login">
      <div class="status-bar"><span>9:41</span><div class="status-icons"><svg viewBox="0 0 24 24"><path d="M1 6l4.5 4.5L12 4l6.5 6.5L23 6"/></svg><svg viewBox="0 0 24 24"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg><svg viewBox="0 0 24 24"><rect x="2" y="7" width="18" height="11" rx="2"/><path d="M22 11v2"/></svg></div></div>
      <div class="auth-bg">
        <div class="auth-orb"></div>
        <div class="auth-orb2"></div>
        <div class="logo">⚡ Zap</div>
        <div class="logo-sub">End-to-end encrypted</div>
        <div class="auth-form">
          <div>
            <div class="input-label">Email or phone</div>
            <input class="inp" type="text" placeholder="you@example.com" id="login-email">
          </div>
          <div>
            <div class="input-label">Password</div>
            <input class="inp" type="password" placeholder="••••••••" id="login-pass">
          </div>
          <button class="btn-primary" onclick="loginAccount()">Sign in</button>
          <div class="divider">or continue with</div>
          <button class="btn-ghost" onclick="navigate('view-home')">🍎  Sign in with Apple</button>
          <button class="btn-ghost" onclick="navigate('view-home')">🔵  Sign in with Google</button>
          <div class="auth-switch">New here? <span onclick="navigate('view-register')">Create account</span></div>
        </div>
      </div>
    </div>

    <!-- ==================== REGISTER SCREEN ==================== -->
    <div class="view hidden" id="view-register">
      <div class="status-bar"><span>9:41</span><div class="status-icons"><svg viewBox="0 0 24 24" fill="var(--text2)" style="width:14px;height:14px"><path d="M1 6l4.5 4.5L12 4l6.5 6.5L23 6"/></svg></div></div>
      <div class="auth-bg" style="padding-top:20px; justify-content:flex-start; overflow-y:auto;">
        <div class="auth-orb"></div>
        <div style="margin-bottom:6px;font-size:28px;font-weight:700;letter-spacing:-0.5px;align-self:flex-start">Create account</div>
        <div style="font-size:13px;color:var(--text3);margin-bottom:32px;align-self:flex-start">Join millions of secure conversations</div>
        <div class="auth-form">
          <div>
            <div class="input-label">Full name</div>
            <input class="inp" type="text" placeholder="Your name" id="register-name">
          </div>
          <div>
            <div class="input-label">Username</div>
            <div class="input-wrap">
              <input class="inp" type="text" placeholder="@username" style="padding-left:32px" id="register-username">
              <span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--accent);font-weight:700">@</span>
            </div>
          </div>
          <div>
            <div class="input-label">Phone number</div>
            <input class="inp" type="tel" placeholder="+63 9XX XXX XXXX" id="register-phone">
          </div>
          <div>
            <div class="input-label">Email</div>
            <input class="inp" type="email" placeholder="you@example.com" id="register-email">
          </div>
          <div>
            <div class="input-label">Password</div>
            <input class="inp" type="password" placeholder="Min. 8 characters" id="register-pass">
          </div>
          <button class="btn-primary" onclick="registerAccount()">Create account</button>
          <div class="auth-switch" style="font-size:11.5px;color:var(--text3);line-height:1.6">By signing up, you agree to our <span style="color:var(--accent2);cursor:pointer">Terms</span> and <span style="color:var(--accent2);cursor:pointer">Privacy Policy</span></div>
          <div class="auth-switch">Already have an account? <span onclick="navigate('view-login')">Sign in</span></div>
        </div>
      </div>
    </div>

    <!-- ==================== OTP SCREEN ==================== -->
    <div class="view hidden" id="view-otp">
      <div class="status-bar"><span>9:41</span></div>
      <div class="auth-bg">
        <div class="auth-orb"></div>
        <button onclick="navigate('view-register')" style="align-self:flex-start;background:var(--bg3);border:1.5px solid var(--border2);border-radius:10px;padding:7px 12px;font-family:var(--font);font-size:13px;color:var(--text2);cursor:pointer;margin-bottom:32px">← Back</button>
        <div style="font-size:28px;font-weight:700;letter-spacing:-0.5px;text-align:center;margin-bottom:6px">Verify your number</div>
        <div style="font-size:13px;color:var(--text3);text-align:center;margin-bottom:8px">Enter the 6-digit code sent to</div>
        <div style="font-size:14px;color:var(--accent2);font-weight:600;text-align:center;margin-bottom:4px">+63 917 XXX XXXX</div>
        <div class="otp-inputs">
          <input class="otp-input" maxlength="1" oninput="otpNext(this,0)">
          <input class="otp-input" maxlength="1" oninput="otpNext(this,1)">
          <input class="otp-input" maxlength="1" oninput="otpNext(this,2)">
          <input class="otp-input" maxlength="1" oninput="otpNext(this,3)">
          <input class="otp-input" maxlength="1" oninput="otpNext(this,4)">
          <input class="otp-input" maxlength="1" oninput="otpNext(this,5)">
        </div>
        <button class="btn-primary" onclick="navigate('view-home')" style="width:100%">Verify & Continue</button>
        <div class="otp-resend" style="margin-top:20px">Didn't receive it? <span>Resend code</span></div>
      </div>
    </div>
`;
