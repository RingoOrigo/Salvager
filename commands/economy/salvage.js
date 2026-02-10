const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, MessageFlags, ButtonStyle, ApplicationIntegrationType, InteractionContextType} = require('discord.js');
const { salvageQuotes, salvageCooldown } = require('../../config/config.json');
const db = require('../../utils/database.js');
const rarity_map = {
    'Legendary': 'Legendaries',
    'Failure': 'Failures',
    'Epic': 'Epics',
    'Uncommon': 'Uncommons',
    'Common': 'Commons'
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('salvage')
        .setDescription('Dive into the cloud sea and bring back treasure!')
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
        const user = interaction.user;

        const salvageButton = new ButtonBuilder()
                            .setCustomId('cmd-salvage')
                            .setLabel('Salvage Now!')
                            .setStyle(ButtonStyle.Primary);
        const balanceButton = new ButtonBuilder()
                                .setCustomId('cmd-balance')
                                .setLabel('View Stats!')
                                .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(salvageButton, balanceButton);

        // Check if the user is on cooldown.
        const now = Date.now();
        const userRow = db.prepare('SELECT * FROM Users WHERE UserID = ?').get(user.id);

        if (userRow) {
            const expirationTime = userRow.LastSalvage + salvageCooldown;

            if (now < expirationTime) {
                const secondsLeft = Math.round((expirationTime - now) / 1000);
                const mins = Math.floor(secondsLeft / 60);
                const secs = Math.floor(secondsLeft % 60);

                await interaction.reply({ content:`You're on cooldown! You can find a new haul in **${mins > 0 ? mins + ' minutes and ' : ''}${secs} seconds.**`, flags: MessageFlags.Ephemeral });
                return;
            }
        }

        const rng = Math.floor(Math.random() * 100 + 1);
        let earnings = 0;
        let rarity = '';

        switch (true) {
            case rng == 1:
                rarity = 'Legendary';
                earnings = Math.floor(Math.random() * 401 + 600);
                break;
            case rng <= 10:
                rarity = 'Epic';
                earnings = Math.floor(Math.random() * 251 + 250);
                break;
            case rng <= 20:
                rarity = 'Failure';
                earnings = 0;
                break;
            case rng <= 40:
                rarity = 'Uncommon';
                earnings = Math.floor(Math.random() * 101 + 100);
                break;
            default:
                rarity = "Common";
                earnings = Math.floor(Math.random() * 65 + 1);
                break;
        }

        const colName = rarity_map[rarity];
        const updateStats = db.prepare(`
                INSERT INTO Users (UserID, Balance, LastSalvage, TotalSalvages, ${colName})
                VALUES (?, ?, ?, 1, 1)
                ON CONFLICT (UserID) DO UPDATE SET
                    Balance = Balance + excluded.Balance,
                    LastSalvage = excluded.LastSalvage,
                    TotalSalvages = TotalSalvages + 1,
                    ${colName} = ${colName} + 1
            `);

        updateStats.run(user.id, earnings, now);

        const earningEmbed = new EmbedBuilder()
                            .setColor('8ca4aa')
                            .setTitle(`<:corecrystaldetailed:1470871392881999994> ${rarity == 'Failure' ? 'Salvage Failure...' : `${rarity} Salvage!`} <:corecrystaldetailed:1470871392881999994>`)
                            .addFields(
                                { name: 'Ouros Earned:', value: `${earnings}` },
                                { name: 'Total Balance:', value: `${userRow.Balance + earnings}` }
                            )
                            .setDescription(rarity == 'Failure' ? 'This is officially the worst salvage run ever...' : salvageQuotes[Math.floor(Math.random() * salvageQuotes.length)])
                            .setTimestamp();

        await interaction.reply({
            content: `**${user.displayName}** dove for salvage!`,
            embeds: [earningEmbed],
            components: [row]
        });
    },
};