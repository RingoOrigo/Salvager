const { Events, ActivityType } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute (client) {
        console.log(`Logged in as ${client.user.displayName}!`);

        client.user.setActivity("Swim like a fish, and drink like one, too!", { type: ActivityType.Custom });
    }
}