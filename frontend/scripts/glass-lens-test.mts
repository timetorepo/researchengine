/**
 * Offline checks for the Liquid Glass lens (lib/glass/lensMap.ts): the middle of
 * the lens is flat, the rim bends toward the centre, the bend is symmetric, the
 * map stays in byte range, and refraction is only claimed for engines that can
 * bend the backdrop. Run with: npm run glass-lens-test
 */
import { lensPixel, lensPixels, LENS_SIZE, refractionSupported } from '../src/lib/glass/lensMap.ts'

let passed = 0
let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  ok  ${name}`) } else { failed++; console.log(`  FAIL ${name} ${detail}`) }
}

console.log('glass-lens-test')
const [cr, cg] = lensPixel(0.5, 0.5)
check('centre is flat (≈128 both channels)', Math.abs(cr - 128) <= 1 && Math.abs(cg - 128) <= 1, `${cr},${cg}`)

const [lr] = lensPixel(0.02, 0.5)
const [rr] = lensPixel(0.98, 0.5)
check('left rim pushes right (red above 128)', lr > 128, String(lr))
check('right rim pushes left (red below 128)', rr < 128, String(rr))
check('rim bend is symmetric', Math.abs((lr - 128) + (rr - 128)) <= 1, `${lr} ${rr}`)

const [, tg] = lensPixel(0.5, 0.02)
const [, bg] = lensPixel(0.5, 0.98)
check('top and bottom rims bend on green', tg > 128 && bg < 128, `${tg} ${bg}`)

check('bend fades out before the middle', lensPixel(0.3, 0.5)[0] === 128 || Math.abs(lensPixel(0.3, 0.5)[0] - 128) < 2, String(lensPixel(0.3, 0.5)[0]))

const buf = lensPixels(LENS_SIZE, LENS_SIZE)
check('buffer size is w*h*4', buf.length === LENS_SIZE * LENS_SIZE * 4, String(buf.length))
check('alpha is opaque everywhere', buf.every((_, i) => i % 4 !== 3 || buf[i] === 255))
check('blue channel is neutral', buf.every((_, i) => i % 4 !== 2 || buf[i] === 128))

check('Chrome can refract', refractionSupported('Mozilla/5.0 (X11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'))
check('Edge can refract', refractionSupported('Mozilla/5.0 Chrome/130.0 Safari/537.36 Edg/130.0'))
check('Safari cannot refract', !refractionSupported('Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'))
check('Firefox cannot refract', !refractionSupported('Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0'))
check('WebKitGTK (Linux desktop) cannot refract', !refractionSupported('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'))

console.log(`\nglass-lens-test: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
