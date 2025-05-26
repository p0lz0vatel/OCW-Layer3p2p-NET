import { createLibp2p } from 'libp2p'
import { webSockets } from '@libp2p/websockets'
import { noise } from '@libp2p/noise'
import { mplex } from '@libp2p/mplex'

async function startBootstrapNode() {
    const node = await createLibp2p({
        addresses: {
            listen: ['/ip4/127.0.0.1/tcp/63785/ws']
        },
        transports: [webSockets()],
        connectionEncryption: [noise()],
        streamMuxers: [mplex()],
    })

    await node.start()
    console.log(`🚀 Bootstrap node started with ID: ${node.peerId.toString()}`)
    
    const listenAddrs = node.getMultiaddrs()
    console.log('Listening on:')
    listenAddrs.forEach(addr => console.log(addr.toString()))
    
    process.stdin.resume()
}

startBootstrapNode().catch(console.error)