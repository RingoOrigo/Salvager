const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, MessageFlags, ButtonStyle, ApplicationIntegrationType, InteractionContextType} = require('discord.js');
const { salvageQuotes, salvageCooldown } = require('../../config/config.json');
const db = require('../../utils/database.js');
const rarity_map = {
    'Legendary': 'Legendaries',
    'Rare': 'Rares',
    'Failure': 'Failures',
    'Epic': 'Epics',
    'Uncommon': 'Uncommons',
    'Common': 'Commons'
}

const item_list = [
    'Ontos',
    'Logos',
    'Pneuma'
]

async function determineSalvage () {
    // Determine rewards from the salvageTable in the database.
    const salvages = db.prepare('SELECT * FROM SalvageTable').all();

    // Calculate total weight
    const totalWeight = salvages.reduce((sum, i) => sum + i.Weight, 0);
    let random = Math.random() * totalWeight;

    // Retrieve the winning role
    for (const salvage of salvages) {
        if (random < salvage.Weight) {
            const reward = Math.floor(Math.random() * (salvage.MaxValue - salvage.MinValue + 1) + salvage.MinValue);

            return { name: salvage.Rarity, amount: reward };
        }

        random -= salvage.Weight;
    }
}

function buildEarningEmbed (userRow, rarity, earnings) {
    const earningEmbed = new EmbedBuilder()
                            .setColor('8ca4aa')
                            .setTitle(`<:corecrystaldetailed:1470871392881999994> ${rarity == 'Failure' ? 'Salvage Failure...' : `${rarity} Salvage!`} <:corecrystaldetailed:1470871392881999994>`)
                            .addFields(
                                { name: 'Ouros Earned:', value: `${earnings}` },
                                { name: 'Total Balance:', value: `${userRow.Balance + earnings}` }
                            )
                            .setDescription(rarity == 'Failure' ? 'This is officially the worst salvage run ever...' : salvageQuotes[Math.floor(Math.random() * salvageQuotes.length)])
                            .setTimestamp()
                            .setFooter({
                                text: `You received a ${((.125 * userRow.TrinityBadges) * 100).toFixed(2)}% boost with ${userRow.TrinityBadges} Badges!`
                            });

    return earningEmbed;
}

async function determineItem (rarity) {
    // If the rarity is epic or legendary, attempt to generate an item.
    let rng = Math.random() * 100 + 1;

    if (rarity != "Legendary" && rarity != "Epic") {
        rng = -1;
    }

    if (rng == 1) {
        rng = Math.floor(Math.random() * 3);
        return item_list[rng];
    }

    return null;
}

async function itemEmbedFlow (interaction, user, rarity, earnings, item, userRow, row) {
    // This will build a different embed to send in the case that an item is generated!

    const earningEmbed = buildEarningEmbed(userRow, rarity, earnings);
    const itemEmbed = new EmbedBuilder()
                    .setTitle(`:${item}: Item Obtained! :${item}:`)
                    .setDescription(`Your ${rarity} salvage was exceptionally lucky, you pulled up the ${item} Core!`)
                    .setFooter({
                        text: `Collect one of each core to craft a badge and earn a boost on all salvages!`
                    })
                    .setTimestamp();

    const updateStats = db.prepare(`
                INSERT INTO Users (UserID, Balance, LastSalvage, TotalSalvages, ${rarity_map[rarity]}, ${item})
                VALUES (?, ?, ?, 1, 1, 1)
                ON CONFLICT (UserID) DO UPDATE SET
                    Balance = Balance + excluded.Balance,
                    LastSalvage = excluded.LastSalvage,
                    TotalSalvages = TotalSalvages + 1,
                    ${rarity_map[rarity]} = ${rarity_map[rarity]} + 1,
                    ${item} = ${item} + 1
            `);

    updateStats.run(user.id, earnings, now);

    await interaction.followUp({
        content: `**${user.displayName}** dove for salvage!`,
        embeds: [earningEmbed, itemEmbed],
        components: [row]
    });

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
        // First, defer the update to allow for computation time, if necessary.
        try {
            await interaction.deferUpdate();
        } catch (error) {
            await interaction.deferReply();
        }

        // Build necessary UI buttons or assign specific variables that will be used later.
        const user = interaction.user;
        const results = await determineSalvage();
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
        let userRow = db.prepare('SELECT * FROM Users WHERE UserID = ?').get(user.id);

        if (!userRow) {
            // If the user doesn't exist, add them to the database.
            db.prepare(`INSERT OR IGNORE INTO users (UserID) VALUES (?)`).run(user.id);
            userRow = db.prepare(`SELECT * FROM users WHERE UserID = ?`).get(user.id);
        }

        if (userRow) {
            // If the user does exist and is on cooldown, send the remainder of their cooldown.
            const expirationTime = userRow.LastSalvage + salvageCooldown;

            if (now < expirationTime) {
                const secondsLeft = Math.round((expirationTime - now) / 1000);
                const mins = Math.floor(secondsLeft / 60);
                const secs = Math.floor(secondsLeft % 60);

                await interaction.followUp({
                    content:`You're on cooldown! You can dive for salvage again in **${mins > 0 ? mins + ' minutes and ' : ''}${secs} seconds.**`, 
                    flags: MessageFlags.Ephemeral });
                return;
            }
        }

        rarity = results.name;
        earnings = results.amount + (results.amount * (1.125 * userRow.TrinityBadges));
        const item = await determineItem(rarity);

        if (item != null) {
            return itemEmbedFlow(interaction, user, rarity, earnings, item, userRow, row);
        }

        // Update the user's info in the database.
        const updateStats = db.prepare(`
                INSERT INTO Users (UserID, Balance, LastSalvage, TotalSalvages, ${rarity_map[rarity]})
                VALUES (?, ?, ?, 1, 1)
                ON CONFLICT (UserID) DO UPDATE SET
                    Balance = Balance + excluded.Balance,
                    LastSalvage = excluded.LastSalvage,
                    TotalSalvages = TotalSalvages + 1,
                    ${rarity_map[rarity]} = ${rarity_map[rarity]} + 1
            `);

        updateStats.run(user.id, earnings, now);

        // Build a pretty embed to make things look a bit better.
        const earningEmbed = buildEarningEmbed(userRow, rarity, earnings);

        await interaction.followUp({
            content: `**${user.displayName}** dove for salvage!`,
            embeds: [earningEmbed],
            components: [row]
        });
    },
};