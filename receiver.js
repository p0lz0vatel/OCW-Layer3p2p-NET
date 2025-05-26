import { createLibp2p } from 'libp2p';
import { webSockets } from '@libp2p/websockets';
import { noise } from '@libp2p/noise';
import { mplex } from '@libp2p/mplex';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { mdns } from '@libp2p/mdns';
import { bootstrap } from '@libp2p/bootstrap';
import { identify } from '@libp2p/identify';

const bootstrapPeers = [
    '/ip4/127.0.0.1/tcp/63785/ws/p2p/12D3KooWD69Wgc2AmdtZytRFr2HMhAppcaXWNgGZzc9A4rcUPFKo'
];

async function receiveData() {
    const libp2p = await createLibp2p({
        transports: [webSockets()],
        connectionEncryption: [noise()],
        streamMuxers: [mplex()],
        peerDiscovery: [mdns(), bootstrap({ list: bootstrapPeers })],
        services: {
            pubsub: gossipsub({
                allowPublishToZeroPeers: true,
                emitSelf: true
            }),
            identify: identify()
        }
    });

    await libp2p.start();
    console.log("📡 Receiver connected to P2P network!");

    libp2p.services.pubsub.subscribe('final-destination');
    
    libp2p.services.pubsub.addEventListener('message', (msg) => {
        try {
            const decodedMsg = JSON.parse(new TextDecoder().decode(msg.detail.data));
            if (decodedMsg.to === "Computer_B") {
                console.log(`📥 Received data: ${decodedMsg.data}`);
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });
}


receiveData().catch(err => console.error('Receiver error:', err));