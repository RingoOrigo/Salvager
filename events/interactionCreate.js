const { Events, MessageFlags } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute (interaction) {
        
        // First check if an interaction is a slashcommand.
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            
            // If the command doesn't exist, do nothing
            if (!command) {
                return;
            }

            // Run the command since it exists, but catch an error if it occurs
            try {
                await command.execute(interaction);
            } catch (error) {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: `Encountered an error while processing command.`, flags: MessageFlags.Ephemeral });
                } else {
                    await interaction.reply({ content: `Encountered an error while processing command.`, flags: MessageFlags.Ephemeral });
                }

                console.log(error);
            }
        }

        if (interaction.isButton()) {

            if (interaction.customId.startsWith('cmd-')) {
                const commandName = interaction.customId.split('-')[1];
                const command = interaction.client.commands.get(commandName);
                if (command) await command.execute(interaction);
            }

        }
    }
}