/**
 * The demo path. A short, original passage about photosynthesis is turned into
 * units and lessons by the on-device sentence engine, so the whole path runs
 * with no document, no key and no network. It is what Learn looks like once
 * there is something to learn from, and it does not add anything to the
 * library.
 */
import { pathOnDevice } from './path'

export const DEMO_DOC = {
  id: 'demo-photosynthesis',
  name: 'Photosynthesis (demo)',
  text: [
    'Photosynthesis is the process that lets plants, algae and some bacteria turn light into chemical energy.',
    'It takes place mainly in the chloroplasts, small green organelles packed with the pigment chlorophyll.',
    'Chlorophyll absorbs most strongly in the blue and red parts of the spectrum and reflects green light, which is why leaves look green.',
    'The light reactions happen in the thylakoid membranes, where water is split and oxygen is released as a by-product.',
    'The energy from light is stored temporarily in two carriers, ATP and NADPH, which move on to the next stage.',
    'The Calvin cycle takes place in the stroma and uses ATP and NADPH to fix carbon dioxide into sugars.',
    'The enzyme RuBisCO catalyses the first step of carbon fixation, and it is considered the most abundant protein on Earth.',
    'Glucose made in photosynthesis is used for energy through respiration, and it is also built into starch, cellulose and other plant material.',
    'Photosynthesis depends on light intensity, carbon dioxide concentration and temperature, and any one of these can become the limiting factor.',
    'Overall, six molecules of carbon dioxide and six of water, in the presence of light, give one molecule of glucose and six of oxygen.',
  ].join(' '),
}

export function demoPath() {
  return pathOnDevice(DEMO_DOC)
}
