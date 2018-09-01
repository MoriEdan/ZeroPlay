<template>
	<div class="root">
		<!-- Game list -->
		<div class="groups">
			<a @click="$router.navigate('play')" class="back">Choose another game</a>

			<span>Please wait till someone wants to play.</span>
		</div>
	</div>
</template>

<style lang="sass" scoped>
	.root
		width: 100%
		height: 100%
		font-size: 0

		background-color: #B12

	.groups
		width: 100%
		position: absolute
		top: 50%
		transform: translateY(-50%)
		text-align: center

		.back
			color: #FFF
			font-size: 20px
			text-decoration: underline
			text-align: center
			cursor: pointer

			position: absolute
			left: 0
			width: 100%
			margin-top: -64px

		span
			color: #FFF
			font-size: 20px
			text-align: center
			cursor: pointer
</style>

<script type="text/javascript">
	import Game from "@/libs/game";
	import Users from "@/libs/users";
	import Lock from "@/libs/lock";
	import {zeroPage} from "@/zero";

	export default {
		name: "play-with-random",
		data() {
			return {
				username: ""
			};
		},

		computed: {
			game() {
				return this.$router.currentParams.game;
			}
		},

		async mounted() {
			// Broadcast that we want to play
			let to;
			const broadcast = () => {
				console.log("Broadcast wait");
				Game.broadcast(`with-random/wait/${this.game}`);
				to = setTimeout(() => {
					// If we haven't found an opponent for 1 minute,
					// try again.
					broadcast();
				}, 60000);
			};
			broadcast();

			// And wait till someone else wants to play the same game
			let lock = new Lock();
			let playing = false;
			const off = await Game.onBroadcast(`with-random/wait/${this.game}`, async opponentAddress => {
				console.log("Wait from", opponentAddress, ", acquiring lock");
				await lock.acquire();
				console.log("Lock acquired");

				// User with address <opponentAddress> wants to play --
				// what about playing with him?
				const gameId = Math.random().toString(36).substr(2);
				console.log("Sending join request");
				Game.sendTo(opponentAddress, `with-random/join/${this.game}`, gameId);

				// Wait for the reply
				Game.onFrom(opponentAddress, `with-random/accept/${gameId}`, () => {
					console.log("Opponent accepted");
					// The user accepts to play with us
					playing = true;
					this.$router.navigate(`play/${this.game}/with-random/${opponentAddress}/${gameId}`);
					off();
					offJoin();
					clearTimeout(to);
				});

				let to1 = setTimeout(() => {
					console.log("Releasing lock after timeout")
					lock.release();
				}, 2000);
				Game.onFrom(opponentAddress, `with-random/decline/${gameId}`, () => {
					console.log("Opponent declined");
					// The user doesn't want to play with us -- he has
					// probably found another opponent while we were doing
					// all this stuff.
					clearTimeout(to1);
					lock.release();
				});
			});

			// Listen for with-random/join
			const offJoin = await Game.onBroadcastMe(`with-random/join/${this.game}`, async (opponentAddress, gameId) => {
				console.log("Got join request from", opponentAddress);
				// Looks like someone wants to join us.
				if(playing) {
					console.log("Playing");
					// If we're already playing with someone, reply with
					// decline
					Game.sendTo(opponentAddress, `with-random/decline/${gameId}`);
					return;
				}

				// Stop listening to others for a few seconds.
				console.log("Acquiring lock for join");
				await lock.acquire();
				console.log("Lock acquired");

				// We got the lock, which means that we haven't found
				// any opponent yet. As we aren't against playing with
				// the current one, send accept.
				console.log("Accept", opponentAddress);
				Game.sendTo(opponentAddress, `with-random/accept/${gameId}`);

				// Our opponent has a lock acquired for waiting for accept
				// and decline, which means that he couldn't find anyone
				// while we were sending/receiving the messages.
				console.log("Play");
				playing = true;
				this.$router.navigate(`play/${this.game}/with-random/${opponentAddress}/${gameId}`);
				off();
				offJoin();
				clearTimeout(to);
			});
		},

		methods: {
			async play() {
				if(!this.username) {
					zeroPage.alert("Please, type in your friend's username");
					return;
				}

				// Get friend's address
				let opponentAddress;
				try {
					opponentAddress = await Users.userNameToAddress(this.username);
				} catch(e) {
					zeroPage.error(e.message);
					return;
				}

				this.readyToPlay = true;

				// Send a request for playing to the friend
				Game.sendTo(opponentAddress, `with-a-friend/join/${this.game}`);

				// Listen to with-a-friend/join/${this.game}
				const off = await Game.onFrom(opponentAddress, `with-a-friend/join/${this.game}`, () => {
					off();

					// It's join request -- accept it
					const gameId = Math.random().toString(36).substr(2);
					Game.sendTo(opponentAddress, `with-a-friend/accept-join/${this.game}`, gameId);

					// Start the game
					this.$router.navigate(`play/${this.game}/with-a-friend/${opponentAddress}/${gameId}`);
				});

				// Wait for this message from the opponent
				const gameId = await Game.waitFrom(opponentAddress, `with-a-friend/accept-join/${this.game}`);

				// The opponent agreed to start the game, so we agree as well
				this.$router.navigate(`play/${this.game}/with-a-friend/${opponentAddress}/${gameId}`);
			}
		}
	};
</script>