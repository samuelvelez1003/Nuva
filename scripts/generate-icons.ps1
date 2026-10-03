param([string]$Out)
Add-Type -AssemblyName System.Drawing

$midnight = [System.Drawing.Color]::FromArgb(255, 16, 20, 17)
$lime = [System.Drawing.Color]::FromArgb(255, 212, 255, 95)
$ivory = [System.Drawing.Color]::FromArgb(255, 245, 246, 240)

# Draws the v2 Ü monogram (matches AppIcon in src/components/brand/Brand.tsx).
# Coordinates use the 100-unit icon grid, scaled by $s, with an extra $k scale
# around the centre (50,50) for Android's adaptive-icon safe zone.
function Draw-Glyph($g, [float]$s, [float]$k, $fg, $dot) {
  $tx = { param($v) (50 + ($v - 50) * $k) * $s }
  $ty = { param($v) (50 + ($v - 50) * $k) * $s }
  $brush = New-Object System.Drawing.SolidBrush $fg
  $w = 8 * $k * $s
  # stems (slightly overlapping the bowl to avoid a seam)
  $g.FillRectangle($brush, (& $tx 30), (& $ty 34), $w, (31 * $k * $s))
  $g.FillRectangle($brush, (& $tx 62), (& $ty 34), $w, (31 * $k * $s))
  # bowl
  $pen = New-Object System.Drawing.Pen $fg, $w
  $r = 16 * $k * $s
  $cx = & $tx 50; $cy = & $ty 64
  $g.DrawArc($pen, $cx - $r, $cy - $r, 2 * $r, 2 * $r, 0, 180)
  # origin: hollow ring
  $ring = New-Object System.Drawing.Pen $fg, (2.5 * $k * $s)
  $r1 = 4.5 * $k * $s
  $g.DrawEllipse($ring, (& $tx 34) - $r1, (& $ty 23) - $r1, 2 * $r1, 2 * $r1)
  # destination: solid accent dot
  $r2 = 5.25 * $k * $s
  $db = New-Object System.Drawing.SolidBrush $dot
  $g.FillEllipse($db, (& $tx 66) - $r2, (& $ty 23) - $r2, 2 * $r2, 2 * $r2)
}

function New-Canvas([int]$size, $bg) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.PixelOffsetMode = 'HighQuality'
  if ($bg) { $g.Clear($bg) } else { $g.Clear([System.Drawing.Color]::Transparent) }
  return @($bmp, $g)
}

function Save($pair, $path) { $pair[1].Dispose(); $pair[0].Save($path, [System.Drawing.Imaging.ImageFormat]::Png); $pair[0].Dispose() }

# iOS / generic icon: full-bleed Midnight (the OS applies the mask).
$c = New-Canvas 1024 $midnight; Draw-Glyph $c[1] 10.24 1.0 $ivory $lime; Save $c "$Out\icon.png"
# Android adaptive: foreground inside the 66% safe zone, solid background, monochrome.
$c = New-Canvas 1024 $null; Draw-Glyph $c[1] 10.24 0.72 $ivory $lime; Save $c "$Out\android-icon-foreground.png"
$c = New-Canvas 1024 $midnight; Save $c "$Out\android-icon-background.png"
$c = New-Canvas 1024 $null; Draw-Glyph $c[1] 10.24 0.72 ([System.Drawing.Color]::White) ([System.Drawing.Color]::White); Save $c "$Out\android-icon-monochrome.png"
# Splash glyph on transparent (background colour comes from app.json).
$c = New-Canvas 1024 $null; Draw-Glyph $c[1] 10.24 1.0 $ivory $lime; Save $c "$Out\splash-icon.png"
# Favicon
$c = New-Canvas 64 $midnight; Draw-Glyph $c[1] 0.64 1.0 $ivory $lime; Save $c "$Out\favicon.png"
"ok"
