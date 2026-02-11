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

        let targetRow = db.prepare(`SELECT * FROM Users WHERE UserID = ?`).get(target.id);

        if (!targetRow) {
            db.prepare(`INSERT OR IGNORE INTO users (UserID) VALUES (?)`).run(target.id);
            targetRow = db.prepare(`SELECT * FROM users WHERE UserID = ?`).get(target.id);
        }

        const salvageButton = new ButtonBuilder()
                            .setCustomId('cmd-salvage')
                            .setLabel('Salvage Now!')
                            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(salvageButton);

        const salvages = targetRow.TotalSalvages;
        const legendaries = targetRow.Legendaries;
        const rares = targetRow.Rares;
        const failures = targetRow.Failures;
        const epics = targetRow.Epics;
        const uncommons = targetRow.Uncommons;
        const commons = targetRow.Commons;

        const balanceEmbed = new EmbedBuilder()
                            .setColor('8ca4aa')
                            .setTitle(`<:corecrystal:1470871394639286475> ${target.displayName}'s Salvage Stats <:corecrystal:1470871394639286475>`)
                            .addFields(
                                { name: '__Current Balance__', value: `${targetRow.Balance} Ouros`},
                                { name: '__Numeric Stats__', value: `**Total Salvages: ** ${salvages}\n**Legendaries: ** ${legendaries}\n**Epic Salvages: ** ${epics}\n**Rares: ** ${rares}\n**Uncommon Salvages: ** ${uncommons}\n**Common Salvages: ** ${commons}\n**Failures: ** ${failures}` },
                                { name: '__Percentage Stats__', value: `**Legendaries: ** ${salvages == 0 ? 0 : (((legendaries / salvages) * 100).toFixed(2))}%\n**Epic Salvages: **${salvages == 0 ? 0 : (((epics / salvages) * 100).toFixed(2))}%\n**Rare Salvages: **${salvages == 0 ? 0 : (((rares / salvages) * 100).toFixed(2))}%\n**Uncommon Salvages: ** ${salvages == 0 ? 0 : (((uncommons / salvages) * 100).toFixed(2))}%\n**Common Salvages: ** ${salvages == 0 ? 0 : (((commons / salvages) * 100).toFixed(2))}%\n**Failures: ** ${salvages == 0 ? 0 : (((failures / salvages) * 100).toFixed(2))}%`},
                                { name:  '__Badge Progression__', value: `**Badges: ** ${targetRow.TrinityBadges}\n**Badge Parts O: ** ${targetRow.Ontos}\n**Badge Parts L: ** ${targetRow.Logos}\n**Badge Parts P: ** ${targetRow.Pneuma}\n`}
                            )
                            .setTimestamp();
        
        await interaction.reply({
            embeds: [balanceEmbed],
            components: [row],
            flags: MessageFlags.Ephemeral
        })
    }
};