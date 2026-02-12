const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, MessageFlags, ButtonStyle, 
    ApplicationIntegrationType, InteractionContextType} = require('discord.js');
const db = require('../../utils/database.js');

function retrieveLeaderboardList () {
    // Return the users with the most badges and balance.
    // Badges are weighted higher than balance is.
    //  (i.e.) A will be above B if A has 1 badge, but 100 Ouros and B has no badges but 200 Ouros.

    const query = db.prepare(`
        SELECT * FROM Users
        ORDER BY TrinityBadges DESC, Balance DESC
        LIMIT 10
    `).all();

    return query;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the global Salvage leaderboard!')
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
        try {
            await interaction.deferUpdate();
        } catch (error) {
            await interaction.deferReply();
        }

        const flags = MessageFlags.Ephemeral;
        const topTen = retrieveLeaderboardList();
        let fieldOne = '', fieldTwo = '';
        let i = 1;

        for (salvager of topTen) {
            // Check if DisplayName is null, as it is only properly updated when salvaging.
            // It is possible that a user could have no balance, but an entry in the database. This means no DisplayName.
            // With small userbases, that user would show up here.
            if (salvager.DisplayName == null) continue;

            fieldOne = fieldOne + `**${i}.** ${salvager.DisplayName}\n`;
            fieldTwo = fieldTwo + `**${salvager.TrinityBadges}**, ${salvager.Balance}\n`;
            ++i;
        }

        const leaderboardEmbed = new EmbedBuilder()
            .setTitle('Salvage Leaderboard')
            .setDescription('These are the ten greatest salvagers known to man! Remember that your balance isn\'t everything- open salvaged crates and craft your Trinity Processor Badges!')
            .setTimestamp()
            .addFields(
                { name: '**Rank, Display Name**', value: fieldOne, inline: true},
                { name: '**Badges, Balance (Ouros)**', value: fieldTwo, inline: true}
            )
            .setColor('8ca4aa');

        const salvageButton = new ButtonBuilder()
                            .setCustomId('cmd-salvage')
                            .setLabel('Salvage Now!')
                            .setStyle(ButtonStyle.Primary);
        const promptButton = new ButtonBuilder()
                .setCustomId('cmd-crate-view')
                .setLabel('Open Shop Menu!')
                .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(salvageButton, promptButton);

        await interaction.followUp({
            embeds: [leaderboardEmbed],
            components: [row],
            flags: flags
        })

    }
}