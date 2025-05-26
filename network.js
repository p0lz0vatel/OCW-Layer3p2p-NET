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

let nodes = [];

class Node {
    constructor(id, rating) {
        this.id = id;
        this.rating = rating;
        this.libp2p = null;
        this.isReady = false;
    }

    async start() {
        try {
            this.libp2p = await createLibp2p({
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

            await this.libp2p.start();

            if (!this.libp2p.services.pubsub) {
                throw new Error(`Pubsub service not initialized for node ${this.id}`);
            }

            this.libp2p.services.pubsub.subscribe('final-destination');
            this.libp2p.services.pubsub.addEventListener('message', (msg) => {
                try {
                    const decodedMsg = JSON.parse(new TextDecoder().decode(msg.detail.data));
                    if (decodedMsg.to === this.id) {
                        console.log(`📥 Receiver Node ${this.id} received approved data: ${decodedMsg.data}`);
                    }
                } catch (error) {
                    console.error(`Error processing message for node ${this.id}:`, error);
                }
            });

            this.isReady = true;
            console.log(`🟢 Node ${this.id} started with rating: ${this.rating} | peerId: ${this.libp2p.peerId.toString()} | Pubsub: ${!!this.libp2p.services.pubsub}`);
            nodes.push(this);
        } catch (error) {
            console.error(`❌ Failed to start node ${this.id}:`, error);
        }
    }
}

function selectLeader() {
    const availableNodes = nodes.filter(node => node.isReady && node.libp2p?.services?.pubsub);
    if (availableNodes.length === 0) {
        console.error("No ready nodes with pubsub available to select a leader");
        return null;
    }
    return availableNodes.reduce((prev, current) => (prev.rating > current.rating ? prev : current));
}

async function setupNetwork() {
    const roles = ['node1', 'node2', 'node3', 'node4', 'node5'];
    
    await Promise.all(roles.map(async (role) => {
        const node = new Node(role, Math.random());
        await node.start();
    }));

    const readyNodes = nodes.filter(node => node.isReady && node.libp2p?.services?.pubsub);
    console.log(`Ready nodes with pubsub: ${readyNodes.length}/${roles.length}`);

    const leader = selectLeader();
    if (!leader) {
        console.error("❌ No leader could be selected - no ready nodes with pubsub available");
        return;
    }

    console.log(`👑 Leader selected: Node ${leader.id}`);
    console.log(`Leader pubsub available: ${!!leader.libp2p.services.pubsub}`);

    try {
        leader.libp2p.services.pubsub.subscribe('validation-topic');
        leader.libp2p.services.pubsub.addEventListener('message', (msg) => {
            try {
                if (msg.detail.topic !== 'validation-topic') return;
                
                const decodedMsg = JSON.parse(new TextDecoder().decode(msg.detail.data));
                console.log(`🔎 Leader received validation request: ${decodedMsg.data}`);

                let votes = 0;
                const totalNodes = nodes.filter(n => n.isReady && n.libp2p?.services?.pubsub).length;

                const voteHandler = (voteMsg) => {
                    try {
                        if (voteMsg.detail.topic === 'vote-topic') {
                            const vote = JSON.parse(new TextDecoder().decode(voteMsg.detail.data));
                            if (vote.valid) votes++;
                        }
                    } catch (error) {
                        console.error('Error processing vote:', error);
                    }
                };

                leader.libp2p.services.pubsub.addEventListener('message', voteHandler);

                setTimeout(() => {
                    leader.libp2p.services.pubsub.removeEventListener('message', voteHandler);
                    
                    if (votes / totalNodes >= 0.9) {
                        console.log(`✅ Data validated. Sending to receiver: ${decodedMsg.to}`);
                        leader.libp2p.services.pubsub.publish('final-destination', 
                            new TextEncoder().encode(JSON.stringify(decodedMsg)));
                    } else {
                        console.log(`❌ Data rejected. Votes: ${votes}/${totalNodes}`);
                    }
                }, 2000);
            } catch (error) {
                console.error('Error processing validation request:', error);
            }
        });
    } catch (error) {
        console.error('Error setting up leader pubsub:', error);
    }
}


setupNetwork().catch(console.error);