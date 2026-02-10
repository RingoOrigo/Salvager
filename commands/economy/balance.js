const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, MessageFlags, ButtonStyle, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
const db = require('../../utils/database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('View your own balance or the balance of another user.')
        .addUserOption(option =>
            option.setName('target')
            .setDescription('The user\'s balance to display. Defaults to yourself.')
        )
        .setContexts([
            InteractionContextType.Guild, 
            InteractionContextType.BotDM, 
            InteractionContextType.PrivateChannel
        ])
        .setIntegrationTypes([
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        ]),
    
    async execute (interaction) {
        const target = interaction.options?.getUser('target') ?? interaction.user;

        const targetRow = db.prepare(`SELECT * FROM Users WHERE UserID = ?`).get(target.id);

        const salvageButton = new ButtonBuilder()
                            .setCustomId('cmd-salvage')
                            .setLabel('Salvage Now!')
                            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(salvageButton);

        const salvages = targetRow.TotalSalvages;
        const legendaries = targetRow.Legendaries;
        const failures = targetRow.Failures;
        const epics = targetRow.Epics;
        const uncommons = targetRow.Uncommons;
        const commons = targetRow.Commons;

        const balanceEmbed = new EmbedBuilder()
                            .setColor('8ca4aa')
                            .setTitle(`<:corecrystal:1470871394639286475> ${target.displayName}'s Salvage Stats <:corecrystal:1470871394639286475>`)
                            .addFields(
                                { name: '__Current Balance__', value: `${targetRow.Balance} Ouros`},
                                { name: '__Numeric Stats__', value: `**Total Salvages: ** ${salvages}\n**Legendaries: ** ${legendaries}\n**Epic Salvages: ** ${epics}\n**Uncommon Salvages: ** ${uncommons}\n**Common Salvages: ** ${commons}\n**Failures: ** ${failures}` },
                                { name: '__Percentage Stats__', value: `**Legendaries: ** ${((legendaries / salvages) * 100).toFixed(2)}%\n**Epic Salvages: **${((epics / salvages) * 100).toFixed(2)}%\n**Uncommon Salvages: ** ${((uncommons / salvages) * 100).toFixed(2)}%\n**Common Salvages: ** ${((commons / salvages) * 100).toFixed(2)}%\n**Failures: ** ${((failures / salvages) * 100).toFixed(2)}%`}
                            )
                            .setTimestamp();
        
        await interaction.reply({
            embeds: [balanceEmbed],
            components: [row],
            flags: MessageFlags.Ephemeral
        })
    }
};