import { RTP_PROTOCOL } from './rtp.js';

export const PROTOCOL_REGISTRY = {
    [RTP_PROTOCOL.id]: RTP_PROTOCOL
};

export function getProtocol(id) {
    return PROTOCOL_REGISTRY[id] || null;
}
