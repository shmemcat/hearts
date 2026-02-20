"""Inline-CSS HTML email templates matching the Hearts website aesthetic."""

_BASE_STYLE = """
<style>
  @import url('https://fonts.googleapis.com/css2?family=Dosis:wght@400;600;700&display=swap');
</style>
"""

_WRAPPER_TOP = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  {style}
</head>
<body style="margin:0;padding:0;background-color:#fee6e6;font-family:'Dosis','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fee6e6;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#fff3f3;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td align="center" style="padding:32px 24px 16px;background:linear-gradient(135deg,#f0b4c4 0%,#f8cdd8 100%);">
              <span style="font-size:36px;line-height:1;">&#9829;</span>
              <h1 style="margin:8px 0 0;font-family:'Dosis','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:28px;font-weight:700;color:#575151;letter-spacing:6px;text-transform:uppercase;">HEARTS</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px 32px 12px;">
"""

_WRAPPER_BOTTOM = """
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:12px 32px 28px;">
              <p style="margin:0;font-family:'Dosis','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:12px;color:#a89a9a;letter-spacing:0.5px;">
                You received this email because of your Hearts account.<br>
                If you didn't request this, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

_BUTTON = """
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
  <tr>
    <td align="center" style="background-color:#e89aaf;border-radius:8px;">
      <a href="{url}" target="_blank" style="display:inline-block;padding:10px 32px;font-family:'Dosis','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:13px;font-weight:700;color:#6b3a4a;letter-spacing:4px;text-transform:uppercase;text-decoration:none;">
        {label}
      </a>
    </td>
  </tr>
</table>
"""

_LINK_FALLBACK = """
<p style="margin:16px 0 0;font-family:'Dosis','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:12px;color:#a89a9a;letter-spacing:0.5px;word-break:break-all;">
  Or copy this link: <a href="{url}" style="color:#c97a8e;">{url}</a>
</p>
"""


def verification_email_html(verify_url: str) -> str:
    body = f"""
              <h2 style="margin:0 0 12px;font-family:'Dosis','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:20px;font-weight:700;color:#575151;letter-spacing:3px;text-align:center;">WELCOME</h2>
              <p style="margin:0;font-family:'Dosis','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:15px;color:#575151;line-height:1.6;text-align:center;letter-spacing:0.8px;">
                Thanks for creating a Hearts account! Verify your email address to get started.
              </p>
              {_BUTTON.format(url=verify_url, label="Verify Email")}
              <p style="margin:0;font-family:'Dosis','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:13px;color:#a89a9a;text-align:center;letter-spacing:0.5px;">
                This link expires in 24 hours.
              </p>
              {_LINK_FALLBACK.format(url=verify_url)}
"""
    return _WRAPPER_TOP.format(style=_BASE_STYLE) + body + _WRAPPER_BOTTOM


def password_reset_email_html(reset_url: str) -> str:
    body = f"""
              <h2 style="margin:0 0 12px;font-family:'Dosis','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:20px;font-weight:700;color:#575151;letter-spacing:3px;text-align:center;">RESET PASSWORD</h2>
              <p style="margin:0;font-family:'Dosis','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:15px;color:#575151;line-height:1.6;text-align:center;letter-spacing:0.8px;">
                We received a request to reset the password for your Hearts account. Click the button below to choose a new password.
              </p>
              {_BUTTON.format(url=reset_url, label="Reset Password")}
              <p style="margin:0;font-family:'Dosis','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:13px;color:#a89a9a;text-align:center;letter-spacing:0.5px;">
                This link expires in 1 hour. If you didn't request this, no action is needed.
              </p>
              {_LINK_FALLBACK.format(url=reset_url)}
"""
    return _WRAPPER_TOP.format(style=_BASE_STYLE) + body + _WRAPPER_BOTTOM
