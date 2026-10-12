// Teaching notes for every lesson, one file per section: learning goals, prerequisites, common
// misconceptions and multiple-choice questions. Lessons show the questions under "Check yourself";
// the teacher page shows everything.

import { TEACHING as algorithms } from './algorithms.js';
import { TEACHING as approx } from './approx.js';
import { TEACHING as atoms } from './atoms.js';
import { TEACHING as experiments } from './experiments.js';
import { TEACHING as fields } from './fields.js';
import { TEACHING as foundations } from './foundations.js';
import { TEACHING as hardware } from './hardware.js';
import { TEACHING as information } from './information.js';
import { TEACHING as noise } from './noise.js';
import { TEACHING as protocols } from './protocols.js';
import { TEACHING as qec } from './qec.js';
import { TEACHING as qml } from './qml.js';
import { TEACHING as waves } from './waves.js';

export const TEACHING = {
  ...experiments,
  ...waves,
  ...atoms,
  ...approx,
  ...foundations,
  ...information,
  ...protocols,
  ...algorithms,
  ...noise,
  ...qec,
  ...hardware,
  ...qml,
  ...fields,
};

export const teachingFor = (slug) => TEACHING[slug] ?? null;
