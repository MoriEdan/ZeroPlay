import {zeroPage} from "@/zero";

export default new class Game {
	// Send a message to address <address>
	sendTo(address, cmd, param=null) {
		zeroPage.cmd("peerBroadcast", {
			message: {
				cmd: "sendTo",
				to: address,
				sendToCmd: cmd,
				sendToParam: param
			},
			immediate: false,
			privatekey: false // Sign with user's private key
		});
	}

	// Wait for a message from address <address>
	async waitFrom(address, cmd) {
		return await new Promise(async resolve => {
			const off = await this.onFrom(address, cmd, param => {
				resolve(param);
				off();
			});
		});
	}

	// Listen to messages from address <address>
	async onFrom(address, cmd, f) {
		const myAddress = (await zeroPage.getSiteInfo()).auth_address;

		const handler = ({params: {hash, message: {to, cmd: inCmd, sendToCmd, sendToParam}, signed_by: from}}) => {
			// All messages with commands sendTo and broadcast are valid
			if(inCmd === "sendTo" && sendToCmd && to) {
				zeroPage.cmd("peerValid", [hash]);
			} else if(inCmd === "broadcast" && sendToCmd) {
				zeroPage.cmd("peerValid", [hash]);
			} else {
				zeroPage.cmd("peerInvalid", [hash]);
				return;
			}

			if(inCmd === "sendTo" && from === address && to === myAddress) {
				// From opponent to us
				if(sendToCmd === cmd) {
					// The right command
					f(sendToParam);
				}
			}
		};
		zeroPage.on("peerReceive", handler);

		return () => {
			zeroPage.off("peerReceive", handler);
		};
	}


	// Send a message to everyone
	broadcast(cmd, param=null) {
		zeroPage.cmd("peerBroadcast", {
			message: {
				cmd: "broadcast",
				sendToCmd: cmd,
				sendToParam: param
			},
			immediate: false,
			privatekey: false // Sign with user's private key
		});
	}

	// Listen to messages from everyone to everyone
	async onBroadcast(cmd, f) {
		const handler = ({params: {hash, message: {to, cmd: inCmd, sendToCmd, sendToParam}, signed_by: from, ip}}) => {
			// All messages with commands sendTo and broadcast are valid
			if(inCmd === "sendTo" && sendToCmd && to) {
				zeroPage.cmd("peerValid", [hash]);
			} else if(inCmd === "broadcast" && sendToCmd) {
				zeroPage.cmd("peerValid", [hash]);
			} else {
				zeroPage.cmd("peerInvalid", [hash]);
				return;
			}

			if(inCmd === "broadcast" && ip !== "self") {
				// From everyone to everyone
				if(sendToCmd === cmd) {
					// The right command
					f(from, sendToParam);
				}
			}
		};
		zeroPage.on("peerReceive", handler);

		return () => {
			zeroPage.off("peerReceive", handler);
		};
	}

	// Listen to messages from everyone to me
	async onBroadcastMe(cmd, f) {
		const myAddress = (await zeroPage.getSiteInfo()).auth_address;

		const handler = ({params: {hash, message: {to, cmd: inCmd, sendToCmd, sendToParam}, signed_by: from, ip}}) => {
			// All messages with commands sendTo and broadcast are valid
			if(inCmd === "sendTo" && sendToCmd && to) {
				zeroPage.cmd("peerValid", [hash]);
			} else if(inCmd === "broadcast" && sendToCmd) {
				zeroPage.cmd("peerValid", [hash]);
			} else {
				zeroPage.cmd("peerInvalid", [hash]);
				return;
			}

			if(inCmd === "sendTo" && to === myAddress && ip !== "self") {
				// From anyone to us
				if(sendToCmd === cmd) {
					// The right command
					f(from, sendToParam);
				}
			}
		};
		zeroPage.on("peerReceive", handler);

		return () => {
			zeroPage.off("peerReceive", handler);
		};
	}
};