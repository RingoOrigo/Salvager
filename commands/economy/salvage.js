const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, MessageFlags, ButtonStyle, 
    ApplicationIntegrationType, InteractionContextType} = require('discord.js');
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
    let roll = Math.random() * totalWeight;
    let result = {};
    let item = null;

    // Retrieve the winning role
    for (const salvage of salvages) {
        if (roll < salvage.Weight) {
            const reward = Math.floor(Math.random() * (salvage.MaxValue - salvage.MinValue + 1) + salvage.MinValue);

            result.salvage = salvage;
            result.amount = reward;
            break;
        }

        roll -= salvage.Weight;
    }

    if (Math.random() * 100 < result.salvage.ItemWeight) {
        item = result.salvage.Item;
    }

    if (item == "Random") {
        item = item_list[Math.floor(Math.random() * 3)];
    }

    result.item = item;
    return result;
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

function buildItemEmbed (item) {
    if (!item) {
        return null;
    }

    const itemEmbed = new EmbedBuilder()
                .setTitle(`Item Obtained!`)
                .setDescription(`Your ${rarity} salvage was exceptionally lucky, you pulled up the ${item} Core!`)
                .setFooter({
                    text: `Collect one of each core to craft a badge and earn a boost on all salvages!`
                })
                .setColor('FFFFFF')
                .setTimestamp();

    return itemEmbed;
}

function updateDB (id, rarity, earnings, item, now, displayName) {
    let updateQuery;

    if (!rarity_map[rarity] && !item) {
        // Event salvage without item
        updateQuery = db.prepare(`
            INSERT INTO Users (UserID, DisplayName, Balance, LastSalvage)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (UserID) DO UPDATE SET
                DisplayName = excluded.DisplayName,
                Balance = Balance + excluded.Balance,
                LastSalvage = excluded.LastSalvage
        `);
    } else if (!rarity_map[rarity] && item) {
        // Event salvage with item
        updateQuery = db.prepare(`
            INSERT INTO Users (UserID, DisplayName, Balance, LastSalvage, ${item})
            VALUES (?, ?, ?, ?, 1)
            ON CONFLICT (UserID) DO UPDATE SET
                DisplayName = excluded.DisplayName,
                Balance = Balance + excluded.Balance,
                LastSalvage = excluded.LastSalvage,
                ${item} = ${item} + 1
        `);
    } else if (item) {
        // Standard salvage with item
        updateQuery = db.prepare(`
            INSERT INTO Users (UserID, DisplayName, Balance, LastSalvage, TotalSalvages, ${rarity_map[rarity]}, ${item})
            VALUES (?, ?, ?, ?, 1, 1, 1)
            ON CONFLICT (UserID) DO UPDATE SET
                DisplayName = excluded.DisplayName,
                Balance = Balance + excluded.Balance,
                LastSalvage = excluded.LastSalvage,
                TotalSalvages = TotalSalvages + 1,
                ${rarity_map[rarity]} = ${rarity_map[rarity]} + 1,
                ${item} = ${item} + 1
        `);
    } else {
        // Standard Salvage, no item
        updateQuery = db.prepare(`
            INSERT INTO Users (UserID, DisplayName, Balance, LastSalvage, TotalSalvages, ${rarity_map[rarity]})
            VALUES (?, ?, ?, ?, 1, 1)
            ON CONFLICT (UserID) DO UPDATE SET
                DisplayName = excluded.DisplayName,
                Balance = Balance + excluded.Balance,
                LastSalvage = excluded.LastSalvage,
                TotalSalvages = TotalSalvages + 1,
                ${rarity_map[rarity]} = ${rarity_map[rarity]} + 1
        `);
    }

    return updateQuery.run(id, displayName, earnings, now);
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
        const result = await determineSalvage();
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
            db.prepare(`INSERT OR IGNORE INTO Users (UserID) VALUES (?)`).run(user.id);
            userRow = db.prepare(`SELECT * FROM Users WHERE UserID = ?`).get(user.id);
            db.prepare(`(
                INSERT INTO Users (UserID, DisplayName)
                VALUES (?, ?)
                ON CONFLICT (UserID) DO UPDATE SET
                    displayName = excluded.DisplayName
            )`).run(user.id, user.globalName);
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
        
        salvage = result.salvage;
        rarity = salvage.Rarity;
        earnings = result.amount + (result.amount * (1.125 * userRow.TrinityBadges));
        const item = result.item;

        updateDB(user.id, rarity, earnings, item, now, user.globalName);

        // Build a pretty embed to make things look a bit better.
        const earningEmbed = buildEarningEmbed(userRow, rarity, earnings);
        const itemEmbed = buildItemEmbed(item);
        let embeds = [earningEmbed];

        if (itemEmbed) {
            embeds = [ earningEmbed, itemEmbed ];
        }

        await interaction.followUp({
            content: `**${user.displayName}** dove for salvage!`,
            embeds: embeds,
            components: [row]
        });
    },
};
