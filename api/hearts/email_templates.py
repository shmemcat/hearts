"""Cards account emails: the Midnight layout with light and dark palettes."""

from html import escape

# Keep the light palette inline so clients that strip CSS still get a complete
# email. Supporting clients override only the colors, preserving the layout.
_DARK_STYLES = {
    "email-background": "background-color:#191b22 !important;",
    "email-sheet": "background-color:#242731 !important;border-color:#3c3e4b !important;",
    "email-ink": "color:#eee7e0 !important;",
    "email-muted": "color:#beb6bf !important;",
    "email-tile": "background-color:#303440 !important;border-color:#50515d !important;color:#ded5d2 !important;",
    "email-red": "color:#c6a6b0 !important;",
    "email-button": "background-color:#c6a6b0 !important;color:#24212a !important;",
    "email-divider": "border-top-color:#42414c !important;",
    "email-link": "color:#ddbdc9 !important;",
}

# Outlook.com prefixes classes and has its own per-message dark mode toggle.
# Use its recoloring hooks there instead of the operating system preference.
_DARK_MEDIA_RULES = "\n".join(
    f'    .{name}:not([class^="x_"]) {{ {style} }}'
    for name, style in _DARK_STYLES.items()
)
_OUTLOOK_DARK_RULES = "\n".join(
    f"  [data-ogsc] .{name}, [data-ogsb] .{name} {{ {style} }}"
    for name, style in _DARK_STYLES.items()
)

_STYLE = f"""<style>
  :root {{ color-scheme:light dark; supported-color-schemes:light dark; }}
  @media only screen and (max-width:540px) {{
    .email-gutter {{ padding:28px 15px !important; }}
    .email-content {{ padding:27px 23px !important; }}
    .email-heading {{ font-size:30px !important;line-height:35px !important; }}
  }}
  @media (prefers-color-scheme:dark) {{
{_DARK_MEDIA_RULES}
  }}
{_OUTLOOK_DARK_RULES}
</style>"""


def _account_email_html(
    url: str,
    *,
    title: str,
    preheader: str,
    heading: str,
    message: str,
    action: str,
    expiry: str,
    ignore: str,
) -> str:
    safe_url = escape(url, quote=True)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <meta name="x-apple-disable-message-reformatting">
  <title>{escape(title)}</title>
  {_STYLE}
</head>
<body class="email-background" style="margin:0;padding:0;background-color:#e6e8ed;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">{escape(preheader)}</div>
  <table role="presentation" class="email-background" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#e6e8ed" style="width:100%;background-color:#e6e8ed;">
    <tr>
      <td class="email-gutter" align="center" style="padding:32px 24px;">
        <!--[if mso]><table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px;">
          <tr>
            <td align="center" style="padding:0 0 25px;">
              <p class="email-ink" style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:30px;font-weight:400;letter-spacing:6px;color:#303a4c;">CARDS</p>
              <p class="email-muted" style="margin:7px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;letter-spacing:0.4px;color:#616b7d;">shmem.dev</p>
            </td>
          </tr>
          <tr>
            <td>
              <table role="presentation" class="email-sheet" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fafbfe" style="width:100%;background-color:#fafbfe;border:1px solid #d7dde7;border-radius:14px;border-collapse:separate;">
                <tr>
                  <td class="email-content" align="center" style="padding:28px 38px 29px;">
                    <table role="presentation" aria-hidden="true" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                      <tr>
                        <td class="email-tile" width="38" height="51" align="center" valign="middle" bgcolor="#eef0f6" style="width:38px;height:51px;background-color:#eef0f6;border:1px solid #c4cbd8;border-radius:4px;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:30px;color:#68758c;">&#9824;&#xfe0e;</td>
                        <td width="8" style="width:8px;font-size:0;line-height:0;">&nbsp;</td>
                        <td class="email-tile" width="38" height="51" align="center" valign="middle" bgcolor="#eef0f6" style="width:38px;height:51px;background-color:#eef0f6;border:1px solid #c4cbd8;border-radius:4px;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:30px;color:#68758c;"><span class="email-red" style="color:#a57283;">&#9829;&#xfe0e;</span></td>
                        <td width="8" style="width:8px;font-size:0;line-height:0;">&nbsp;</td>
                        <td class="email-tile" width="38" height="51" align="center" valign="middle" bgcolor="#eef0f6" style="width:38px;height:51px;background-color:#eef0f6;border:1px solid #c4cbd8;border-radius:4px;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:30px;color:#68758c;">&#9827;&#xfe0e;</td>
                        <td width="8" style="width:8px;font-size:0;line-height:0;">&nbsp;</td>
                        <td class="email-tile" width="38" height="51" align="center" valign="middle" bgcolor="#eef0f6" style="width:38px;height:51px;background-color:#eef0f6;border:1px solid #c4cbd8;border-radius:4px;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:30px;color:#68758c;"><span class="email-red" style="color:#a57283;">&#9830;&#xfe0e;</span></td>
                      </tr>
                    </table>
                    <h1 class="email-ink email-heading" style="margin:25px 0 15px;font-family:Georgia,'Times New Roman',serif;font-size:35px;line-height:41px;font-weight:400;letter-spacing:-0.8px;text-align:center;color:#303a4c;">{escape(heading)}</h1>
                    <p class="email-muted" style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:26px;text-align:center;color:#616b7d;">{escape(message)}</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                      <tr>
                        <td style="padding:26px 0 0;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                            <tr>
                              <td class="email-button" align="center" bgcolor="#485873" style="background-color:#485873;color:#ffffff;border-radius:6px;mso-padding-alt:13px 25px;">
                                <a class="email-button" href="{safe_url}" target="_blank" style="display:block;padding:13px 25px;background-color:#485873;color:#ffffff;border-radius:6px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;font-weight:600;text-align:center;text-decoration:none;mso-padding-alt:0;">{escape(action)}</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    <p class="email-muted" style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;text-align:center;color:#616b7d;">{escape(expiry)}</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                      <tr>
                        <td style="padding:24px 0 0;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;">
                            <tr>
                              <td class="email-divider" align="left" style="padding:22px 0 0;border-top:1px solid #e1e5ec;">
                                <p class="email-muted" style="margin:0 0 7px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#616b7d;">Button not working? Copy this link:</p>
                                <a class="email-link" href="{safe_url}" target="_blank" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;color:#485873;text-decoration:underline;word-break:break-all;overflow-wrap:anywhere;">{safe_url}</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    <p class="email-muted" style="margin:18px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;text-align:center;color:#616b7d;">{escape(ignore)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>"""


def verification_email_html(verify_url: str) -> str:
    return _account_email_html(
        verify_url,
        title="Verify your Cards account",
        preheader="Verify your email to finish setting up your Cards account.",
        heading="Welcome to Cards.",
        message="Your shmem.dev Cards account is almost ready. Verify your email to start playing.",
        action="Verify email",
        expiry="This link expires in 24 hours.",
        ignore="If you didn’t create a Cards account, you can safely ignore this email.",
    )


def password_reset_email_html(reset_url: str) -> str:
    return _account_email_html(
        reset_url,
        title="Reset your Cards password",
        preheader="Choose a new password for your Cards account. This link expires in 1 hour.",
        heading="Reset your password.",
        message="We received a request to reset the password for your shmem.dev Cards account. Choose a new password below.",
        action="Reset password",
        expiry="This link expires in 1 hour.",
        ignore="Didn’t request a reset? You can safely ignore this email. Your password will stay the same.",
    )
