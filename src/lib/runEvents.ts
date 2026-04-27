import { EventEmitter } from 'events';

const runEventBus = new EventEmitter();
runEventBus.setMaxListeners(100);

export default runEventBus;