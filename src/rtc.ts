class RealTimeCommunication {
  socket: RTCPeerConnection;
  channel: RTCDataChannel;
  onMessage: (message: MessageEvent<any>) => void

    constructor(onIceCandidate: (candidate: RTCIceCandidate) => void, onMessage: (message: MessageEvent<any>) => void) {
      this.onMessage = onMessage;
      console.log('Creating connection');
      this.socket = new RTCPeerConnection({
        iceServers: [
          {
            urls: "stun:stun2.l.google.com:19302"
          },
          {
            urls: 'turn:relay.backups.cz',
            credential: 'webrtc',
            username: 'webrtc'
        }
        ]
      });
  
      this.socket.ondatachannel = e => {
        console.log('Channel received: ', e);
        this.channel = e.channel;
        this.channel.onmessage = message => {
          this.onMessage(message);
        };
        this.channel.onopen = e => {
          console.log('Channel opened', e)
        };
        this.channel.onclose = e => {
          console.log('Channel closed', e);
        };
      }
  
      this.socket.onicecandidate = (event) => {
        if (event.candidate) {
          onIceCandidate(event.candidate);
          console.log('Candidate', JSON.stringify(event.candidate));
        }
      };
    }
  
      addIce (ice: RTCIceCandidateInit | RTCIceCandidate) {
        this.socket.addIceCandidate(ice).then(() => console.log('Success')).catch(e => console.log('Error', e));
      }
      
  
      offer() {
        return new Promise((resolve, reject) => {
          this.channel = this.socket.createDataChannel('sendDataChannel', null);
    
          this.channel.onopen = () => console.log("Open: ", this.channel.readyState);
          this.channel.onclose = () => console.log("Closed: ", this.channel.readyState);
          this.channel.onmessage = message => {
            this.onMessage(message);
          };
    
          this.socket.createOffer().then(
            (desc) => {
              this.socket.setLocalDescription(desc);
              console.log('Offer from localConnection', desc.sdp);
              console.log(JSON.stringify(desc));
              resolve(desc);
            },
            (error) => {
              console.log('Failed to create session description: ', error.toString());
            }
          );
        });
      }
  
      answer(desc: RTCSessionDescriptionInit) {
        this.socket.setRemoteDescription(desc);
        return this.socket.createAnswer().then(
          desc => {
            this.socket.setLocalDescription(desc);
            console.log(JSON.stringify(desc));
            return desc;
          },
          e => {
            console.log('Answer failed', e)
          }
        );
      }
  
      complete(desc: RTCSessionDescriptionInit) {
        this.socket.setRemoteDescription(desc);
      }
  
      send(message: string) {
        if (this.channel && this.channel.readyState == "open") {
          this.channel.send(message);
        }
      }
  
  }
  
  export default RealTimeCommunication;