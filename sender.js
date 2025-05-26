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

async function sendData() {
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
    console.log("📡 Sender connected to P2P network!");

    console.log("⏳ Waiting for peer connections...");
    while (libp2p.getPeers().length === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log(`✅ Connected to ${libp2p.getPeers().length} peer(s)`);

    const message = JSON.stringify({ 
        from: "Computer_A", 
        to: "Computer_B", 
        data: "Hello from A!" 
    });

    try {
        await libp2p.services.pubsub.publish(
            'final-destination',
            new TextEncoder().encode(message)
        );
        console.log(`📨 Successfully sent data: ${message}`);
    } catch (error) {
        console.error('Failed to send message:', error);
    }
}


sendData().catch(err => console.error('Sender error:', err));