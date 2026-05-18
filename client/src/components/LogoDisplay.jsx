/**
 * LogoDisplay — unified logo renderer used across Admin, Partner and Landing page.
 * Respects logo_fit / logo_bg / logo_padding / logo_shape settings stored per agency.
 */

// Shape → border-radius mapping
export const SHAPE_RADIUS = {
  rounded:     (size) => `${Math.round(size * 0.22)}px`,
  circle:      ()     => '50%',
  square:      ()     => '0px',
  oval:        ()     => '50%',
};

// Background option → CSS value
export function logoBgColor(bg, brandColor = '#1e40af') {
  switch (bg) {
    case 'white':       return '#ffffff';
    case 'brand':       return brandColor;
    case 'light':       return brandColor + '1a';   // ~10% opacity tint
    case 'transparent': return 'transparent';
    default:            return '#ffffff';
  }
}

/**
 * LogoDisplay
 * @param {string}  logoUrl     - URL of the logo image
 * @param {string}  fit         - 'contain' | 'cover' | 'fill'  (default: 'contain')
 * @param {string}  bg          - 'white' | 'transparent' | 'brand' | 'light'  (default: 'white')
 * @param {number}  padding     - inner padding in px (default: 8)
 * @param {string}  brandColor  - brand color hex (default: '#1e40af')
 * @param {string}  initials    - fallback text when no logo
 * @param {string}  shape       - 'rounded' | 'circle' | 'square' | 'oval' (default: 'rounded')
 * @param {number}  size        - container px size (default: 48)
 * @param {string}  className   - extra class on wrapper div
 * @param {object}  style       - extra inline style on wrapper div
 */
export default function LogoDisplay({
  logoUrl,
  fit         = 'contain',
  bg          = 'white',
  padding     = 8,
  brandColor  = '#1e40af',
  initials    = 'P',
  shape       = 'rounded',
  size        = 48,
  className   = '',
  style       = {},
}) {
  const borderRadius = (SHAPE_RADIUS[shape] || SHAPE_RADIUS.rounded)(size);
  const backgroundColor = logoUrl ? logoBgColor(bg, brandColor) : brandColor;

  const containerStyle = {
    width:          size,
    height:         size,
    minWidth:       size,
    borderRadius,
    overflow:       'hidden',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
    background:     backgroundColor,
    ...style,
  };

  const imgStyle = {
    width:      '100%',
    height:     '100%',
    objectFit:  fit === 'fill' ? 'fill' : fit === 'cover' ? 'cover' : 'contain',
    padding:    `${Math.max(0, padding)}px`,
    display:    'block',
  };

  const textStyle = {
    fontWeight:  900,
    fontSize:    Math.round(size * 0.36),
    color:       'white',
    lineHeight:  1,
    userSelect:  'none',
    letterSpacing: '-0.5px',
  };

  return (
    <div className={className} style={containerStyle}>
      {logoUrl
        ? <img src={logoUrl} alt="logo" style={imgStyle} />
        : <span style={textStyle}>{initials}</span>
      }
    </div>
  );
}
