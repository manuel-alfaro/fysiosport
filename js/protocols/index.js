import { RTP_PROTOCOL } from './rtp.js';
import { SHOULDER_SCREENING_PROTOCOL } from './shoulder_screening.js';
import { SENIOR_FITNESS_PROTOCOL } from './senior_fitness.js';
import { COMPLETE_REHAB_PROTOCOL } from './complete_rehab.js';
import { RUN_SAFER_PROTOCOL } from './run_safer.js';

export const PROTOCOL_REGISTRY = {
    [RTP_PROTOCOL.id]: RTP_PROTOCOL,
    [SHOULDER_SCREENING_PROTOCOL.id]: SHOULDER_SCREENING_PROTOCOL,
    [SENIOR_FITNESS_PROTOCOL.id]: SENIOR_FITNESS_PROTOCOL,
    [COMPLETE_REHAB_PROTOCOL.id]: COMPLETE_REHAB_PROTOCOL,
    [RUN_SAFER_PROTOCOL.id]: RUN_SAFER_PROTOCOL
};

export function getProtocol(id) {
    return PROTOCOL_REGISTRY[id] || null;
}
