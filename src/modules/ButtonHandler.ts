import { ButtonInteraction, EmbedBuilder, GuildMember, InteractionResponse, Message, TextChannel } from 'discord.js';
import { Report } from '../entity/Report';
import Bot from '../Bot';

export default interface ButtonHandler { client: Bot; id: string; interaction: ButtonInteraction }

interface RemoveHierarchy {
    [key: string]: string[];
}
export default class ButtonHandler {
    constructor(client: Bot, id: string, interaction: ButtonInteraction<'cached'>) {
        this.client = client;
        this.id = id;
        this.interaction = interaction;
        switch (id) {
            case 'rejectRoleAssign': this.rejectRoleAssign(interaction); break;
            case 'approveReport': this.approveReport(interaction); break;
            case 'rejectReport': this.rejectReport(interaction); break;
            case 'approveDPM': this.approveDPM(interaction); break;
            case 'rejectDPM': this.rejectDPM(interaction); break;
            default: break;
        }
    }

    get userId(): string {
        return this.interaction.user.id;
    }

    get currentTime(): number {
        return Math.round(Date.now() / 1000)
    }

    private async rejectDPM(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {

        const { colours } = this.client.util;

        await interaction.deferReply({ ephemeral: true });
        const hasRolePermissions = await this.client.util.hasRolePermissions(this.client, ['moderator', 'admin', 'owner'], interaction);
        if (hasRolePermissions) {
            const messageEmbed = interaction.message.embeds[0];
            const messageContent = messageEmbed.data.description;
            const oldTimestamp = messageEmbed.timestamp ? new Date(messageEmbed.timestamp) : new Date();

            const newEmbed = new EmbedBuilder()
                .setTimestamp(oldTimestamp)
                .setColor(messageEmbed.color)
                .setDescription(`
                ${messageContent}\n
                > Application rejected by <@${this.userId}> <t:${this.currentTime}:R>.`);
            await interaction.message.edit({ embeds: [newEmbed], components: [] })
            const replyEmbed = new EmbedBuilder()
                .setColor(colours.discord.green)
                .setDescription('Application successfully rejected!');
            return await interaction.editReply({ embeds: [replyEmbed] });
        } else {
            this.client.logger.log(
                {
                    message: `Attempted restricted permissions. { command: Reject DPM Application, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                    handler: this.constructor.name,
                },
                true
            );
            return await interaction.editReply({ content: 'You do not have permissions to run this command. This incident has been logged.' });
        }
    }

    private async approveDPM(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {

        const removeHierarchy: RemoveHierarchy = {
            'adept': ['initiate'],
            'mastery': ['initiate', 'adept'],
            'extreme': ['mastery', 'initiate', 'adept'],
        }

        const { colours, roles, channels, stripRole, getKeyFromValue } = this.client.util;

        await interaction.deferReply({ ephemeral: true });
        const hasRolePermissions = await this.client.util.hasRolePermissions(this.client, ['moderator', 'admin', 'owner'], interaction);
        if (hasRolePermissions) {
            const messageEmbed = interaction.message.embeds[0];
            const messageContent = messageEmbed.data.description;
            const oldTimestamp = messageEmbed.timestamp ? new Date(messageEmbed.timestamp) : new Date();
            const userIdRegex = messageContent?.match(/<@\d*\>/gm);
            const assignedRoles = messageContent?.match(/<@&\d*\>/gm)?.map(unstrippedRole => stripRole(unstrippedRole));

            const errorEmbed = new EmbedBuilder()
                .setColor(this.client.util.colours.discord.red)
                .setDescription('Something went wrong with detecting either the role or user.');
            if (!assignedRoles || !userIdRegex) return await interaction.editReply({ embeds: [errorEmbed] });

            const userId = userIdRegex[0].slice(2, -1);
            const user = await interaction.guild?.members.fetch(userId);
            const userRoles = user?.roles.cache.map(role => role.id) || [];
            await user?.roles.add(assignedRoles[0]);

            // Remove inferior roles
            const roleKey = getKeyFromValue(roles, `<@&${assignedRoles[0]}>`);
            if (roleKey in removeHierarchy) {
                for await (const roleToRemove of removeHierarchy[roleKey]) {
                    const removeRoleId = stripRole(roles[roleToRemove]);
                    if (userRoles?.includes(removeRoleId)) await user?.roles.remove(removeRoleId);
                };
            }

            const announcementChannel = await this.client.channels.fetch(channels.roleConfirmations) as TextChannel;
            const embed = new EmbedBuilder()
                .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() || this.client.user?.avatarURL() || 'https://media.discordapp.net/attachments/1027186342620299315/1047598720834875422/618px-Solly_pet_1.png' })
                .setTimestamp()
                .setColor(messageEmbed.color || colours.lightblue)
                .setDescription(`Congratulations to <@${userId}> on achieving <@&${assignedRoles[0]}>!`);

            await announcementChannel.send({ embeds: [embed] });

            const newEmbed = new EmbedBuilder()
                .setTimestamp(oldTimestamp)
                .setColor(messageEmbed.color)
                .setDescription(`
                ${messageContent}\n
                > Application approved by <@${this.userId}> <t:${this.currentTime}:R>.`);
            await interaction.message.edit({ embeds: [newEmbed], components: [] })
            const replyEmbed = new EmbedBuilder()
                .setColor(colours.discord.green)
                .setDescription('Role successfully approved!');
            return await interaction.editReply({ embeds: [replyEmbed] });
        } else {
            this.client.logger.log(
                {
                    message: `Attempted restricted permissions. { command: Approve DPM Application, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                    handler: this.constructor.name,
                },
                true
            );
            return await interaction.editReply({ content: 'You do not have permissions to run this command. This incident has been logged.' });
        }
    }

    private async rejectReport(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {
        await interaction.deferReply({ ephemeral: true });
        const { hasRolePermissions, hasOverridePermissions } = this.client.util;
        const rolePermissions = await hasRolePermissions(this.client, ['admin', 'owner'], interaction);
        const overridePermissions = await hasOverridePermissions(interaction, 'reports');

        if (rolePermissions || overridePermissions) {
            const messageEmbed = interaction.message.embeds[0];
            const messageContent = messageEmbed.data.description;
            const oldTimestamp = messageEmbed.timestamp ? new Date(messageEmbed.timestamp) : new Date();
            const newEmbed = new EmbedBuilder()
                .setTimestamp(oldTimestamp)
                .setColor(messageEmbed.color)
                .setDescription(`
                ${messageContent}\n
                > Report rejected by <@${this.userId}> <t:${this.currentTime}:R>.`);
            if (messageEmbed.image) newEmbed.setImage(messageEmbed.image.url);
            await interaction.message.edit({ embeds: [newEmbed], components: [] })
            const replyEmbed = new EmbedBuilder()
                .setColor(this.client.util.colours.discord.green)
                .setDescription('Report successfully rejected!');
            return await interaction.editReply({ embeds: [replyEmbed] });
        } else {
            this.client.logger.log(
                {
                    message: `Attempted restricted permissions. { command: Reject Report, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                    handler: this.constructor.name,
                },
                true
            );
            return await interaction.editReply({ content: 'You do not have permissions to run this command. This incident has been logged.' });
        }
    }

    private async approveReport(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {

        interface CombinationParent {
            [roleKey: string]: string;
        }

        interface Categories {
            [category: string]: string[];
        }

        interface Prerequisites {
            [prerequisite: string]: Prerequisite
        }

        interface Prerequisite {
            [key: string]: string[]
        }

        const prerequisites: Prerequisites = {
            'duoRootskips': {
                'rootskips': ['threeSevenRootskips']
            },
            'threeSevenRootskips': {
                'rootskips': ['duoRootskips']
            },
            'duoExperienced': {
                'experienced': ['threeSevenExperienced']
            },
            'threeSevenExperienced': {
                'experienced': ['duoExperienced']
            },
            'duoMaster': {
                'master': ['threeSevenMaster']
            },
            'threeSevenMaster': {
                'master': ['duoMaster']
            },
            'duoGrandmaster': {
                'grandmaster': ['threeSevenGrandmaster']
            },
            'threeSevenGrandmaster': {
                'grandmaster': ['duoGrandmaster']
            }
        }

        const combinationParent: CombinationParent = {
            'duoRootskips': 'rootskips',
            'threeSevenRootskips': 'rootskips',
            'duoExperienced': 'experienced',
            'threeSevenExperienced': 'experienced',
            'duoMaster': 'master',
            'threeSevenMaster': 'master',
            'duoGrandmaster': 'grandmaster',
            'threeSevenGrandmaster': 'grandmaster'
        }

        const categories: Categories = {
            duo: ['noRealm', 'duoRootskips', 'duoExperienced', 'duoMaster', 'duoGrandmaster'],
            threeSeven: ['noRealm', 'threeSevenRootskips', 'threeSevenExperienced', 'threeSevenMaster', 'threeSevenGrandmaster'],
            combined: ['rootskips', 'experienced', 'master', 'grandmaster'],
        }

        const removeHierarchy: RemoveHierarchy = {
            'threeSevenRootskips': ['noRealm'],
            'duoExperienced': ['duoRootskips'],
            'threeSevenExperienced': ['threeSevenRootskips', 'noRealm'],
            'duoMaster': ['duoExperienced', 'duoRootskips'],
            'threeSevenMaster': ['threeSevenExperienced', 'threeSevenRootskips', 'noRealm'],
            'duoGrandmaster': ['duoMaster', 'duoExperienced', 'duoRootskips'],
            'threeSevenGrandmaster': ['threeSevenMaster', 'threeSevenExperienced', 'threeSevenRootskips', 'noRealm'],
            'rootskips': ['noRealm'],
            'experienced': ['noRealm', 'rootskips'],
            'master': ['noRealm', 'rootskips', 'experienced'],
            'grandmaster': ['noRealm', 'rootskips', 'experienced', 'master'],
        }

        const { roles, stripRole, getKeyFromValue, categorize, hasRolePermissions, hasOverridePermissions } = this.client.util;

        await interaction.deferReply({ ephemeral: true });

        const rolePermissions = await hasRolePermissions(this.client, ['admin', 'owner'], interaction);
        const overridePermissions = await hasOverridePermissions(interaction, 'reports');
        
        if (rolePermissions || overridePermissions) {
            const messageEmbed = interaction.message.embeds[0];
            const messageContent = messageEmbed.data.description;
            const userIdRegex = messageContent?.match(/<@\d*\>/gm);
            const roleRegex = messageContent?.match(/<@&\d*\>/gm);
            let dirtySubmitterId;
            let dirtyReportedUserId;
            let dirtyRoleId;
            if (userIdRegex) dirtySubmitterId = userIdRegex[0];
            if (userIdRegex) dirtyReportedUserId = userIdRegex[1];
            if (roleRegex) dirtyRoleId = roleRegex[0];

            let embedMessage = '';
            let reportCount = 0;

            // Attempt to DM a notification to trialee.
            const sendRoleRemovalDM = async (user: GuildMember) => {
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setTitle('Your role has been removed.')
                        .setColor(this.client.util.colours.discord.red)
                        .setDescription(`
                        Your role has been degraded due to multiple approved reports.
                        `);
                    await user.send({ embeds: [dmEmbed] });
                } catch {
                    this.client.logger.log(
                        {
                            message: `Attempted to send report role degradation notification. { user: ${user.id} }`,
                            handler: this.constructor.name,
                        },
                        true
                    );
                }
            }

            if (dirtySubmitterId && dirtyReportedUserId && dirtyRoleId) {
                let removeRole = false
                const { dataSource } = this.client;
                const repository = dataSource.getRepository(Report);
                const [_existingReports, reportsCount] = await repository.findAndCount({
                    where: {
                        reportedUser: dirtyReportedUserId,
                        role: dirtyRoleId,
                        expired: false
                    }
                })
                // Add new report
                const report = new Report();
                report.reporter = dirtySubmitterId;
                report.reportedUser = dirtyReportedUserId;
                report.role = dirtyRoleId;
                report.link = interaction.message.url;
                await repository.save(report);

                // Check length of reports that are active.
                removeRole = reportsCount + 1 >= 3 ? true : false;

                if (removeRole) {
                    await repository.update({ expired: false }, { expired: true });
                    reportCount = 3;
                    const roleKey = getKeyFromValue(roles, dirtyRoleId);
                    const category = categorize(roleKey);
                    const combinationKey = combinationParent[roleKey] ? combinationParent[roleKey] : '';
                    const roleId = stripRole(dirtyRoleId);
                    const combinationRoleId = combinationKey ? stripRole(roles[combinationKey]) : '';
                    const userId = dirtyReportedUserId.slice(2, -1);
                    const user = await interaction.guild?.members.fetch(userId);
                    let userRoles = user?.roles.cache.map(role => role.id) || [];
                    // Boolean to check for early exit conditions as we can't break out. These conditions are: No role or no combo role.
                    let handled = false;
                    // Does not have the role.
                    if (!userRoles.includes(roleId) && !userRoles.includes(combinationRoleId)) {
                        handled = true;
                        embedMessage = `This user does not have this role to remove.`;
                    }
                    // Has the role, but the role has no combination role
                    if (userRoles.includes(roleId) && !combinationRoleId && !combinationKey) {
                        await user?.roles.remove(roleId);
                        userRoles = userRoles.filter(item => item !== roleId);
                        handled = true;
                        embedMessage = `${dirtyRoleId} was removed.\n`;
                        sendRoleRemovalDM(user);
                    }
                    // Has the role but no combination role (just in case)
                    if (userRoles.includes(roleId) && !userRoles.includes(combinationRoleId) && (handled === false)) {
                        await user?.roles.remove(roleId);
                        userRoles = userRoles.filter(item => item !== roleId);
                        // i.e. index of 'grandmaster'
                        const combinedCategoryIndex = categories.combined.indexOf(combinationKey);
                        // i.e index of 'master' FROM 'grandmaster'
                        const newCombinedCategoryIndex: number | null = combinedCategoryIndex !== 0 ? combinedCategoryIndex - 1 : null;
                        // If user already has the combined role for degradation
                        if ((newCombinedCategoryIndex !== null) && userRoles.includes(stripRole(roles[categories.combined[newCombinedCategoryIndex]]))) {
                            // Do nothing. Tags are already removed and combo role for degraded role already exists.
                            embedMessage = `
                            ${dirtyRoleId} was removed.
                            <@${user.id}> already has <@&${roles[categories[category][newCombinedCategoryIndex]]}>.
                            No degraded role was assigned.
                            `
                            sendRoleRemovalDM(user);
                        } else {
                            // They don't have the combined role, therefore we have to add degraded role and opposite role.
                            const reportedCategoryIndex = categories[category].indexOf(roleKey);
                            const newCategoryIndex: number | null = reportedCategoryIndex !== 0 ? reportedCategoryIndex - 1 : null;
                            if (newCategoryIndex !== null) {
                                // i.e. duoMaster
                                const newRoleKey = categories[category][newCategoryIndex];
                                let anyAdditionalRole;
                                if (newRoleKey in prerequisites) {
                                    // For each key inside a role pre-requisite
                                    for (const key in prerequisites[newRoleKey]) {
                                        let assign = true;
                                        // Loop over each role and check if they have all pre-requisites
                                        prerequisites[newRoleKey][key].forEach((prereqRole: string) => {
                                            const roleId = stripRole(roles[prereqRole]);
                                            if (!(userRoles?.includes(roleId))) {
                                                assign = false;
                                            }
                                        })
                                        // Assign the additional role and remove the existing pre-requisite roles
                                        if (assign) {
                                            const assignedRoleId = stripRole(roles[key]);
                                            if (!userRoles?.includes(assignedRoleId)) await user?.roles.add(assignedRoleId);
                                            prerequisites[newRoleKey][key].forEach((prereqRole: string) => {
                                                const roleId = stripRole(roles[prereqRole]);
                                                if (userRoles?.includes(roleId)) user?.roles.remove(roleId);
                                            })
                                            // Remove inferior roles for combination roles
                                            if (key in removeHierarchy) {
                                                for await (const roleToRemove of removeHierarchy[key]) {
                                                    const removeRoleId = stripRole(roles[roleToRemove]);
                                                    if (userRoles?.includes(removeRoleId)) await user?.roles.remove(removeRoleId);
                                                };
                                            }
                                            if (newRoleKey in removeHierarchy) {
                                                for await (const roleToRemove of removeHierarchy[newRoleKey]) {
                                                    const removeRoleId = stripRole(roles[roleToRemove]);
                                                    if (userRoles?.includes(removeRoleId)) await user?.roles.remove(removeRoleId);
                                                };
                                            }
                                            anyAdditionalRole = key;
                                            // Just add the new role as no pre-requisites for the combined role
                                        } else {
                                            const roleId = stripRole(roles[newRoleKey]);
                                            if (!userRoles?.includes(roleId)) user?.roles.add(roleId);
                                            // Remove inferior roles
                                            if (newRoleKey in removeHierarchy) {
                                                for await (const roleToRemove of removeHierarchy[newRoleKey]) {
                                                    const removeRoleId = stripRole(roles[roleToRemove]);
                                                    if (userRoles?.includes(removeRoleId)) await user?.roles.remove(removeRoleId);
                                                };
                                            }
                                        }
                                    }
                                    // No pre-requisite needed so just assign role
                                } else {
                                    const roleId = stripRole(roles[newRoleKey]);
                                    if (!userRoles?.includes(roleId)) await user?.roles.add(roleId);
                                    if (newRoleKey in removeHierarchy) {
                                        for await (const roleToRemove of removeHierarchy[newRoleKey]) {
                                            const removeRoleId = stripRole(roles[roleToRemove]);
                                            if (userRoles?.includes(removeRoleId)) await user?.roles.remove(removeRoleId);
                                        };
                                    }
                                }
                                embedMessage = `${dirtyRoleId} was degraded into ${anyAdditionalRole ? `${roles[anyAdditionalRole]}` : `${roles[newRoleKey]}`}.\n`;
                                sendRoleRemovalDM(user);
                            }
                        }
                        handled = true;
                    }
                    // Has the combination role and the role will need degrading
                    if (userRoles.includes(combinationRoleId) && (handled === false)) {
                        const hasHigherRole = (role: string) => {
                            try {
                                if (!categorize(role)) return false;
                                const categorizedHierarchy = categories[categorize(role)];
                                const sliceFromIndex: number = categorizedHierarchy.indexOf(role) + 1;
                                const hierarchyList = categorizedHierarchy.slice(sliceFromIndex);
                                const hierarchyIdList = hierarchyList.map((item: string) => stripRole(roles[item]));
                                const intersection = hierarchyIdList.filter((roleId: string) => userRoles.includes(roleId));
                                if (intersection.length === 0) {
                                    return false
                                } else {
                                    return true
                                };
                            }
                            catch (err) { return false }
                        }
                        // Remove role
                        await user?.roles.remove(combinationRoleId);
                        userRoles = userRoles.filter(item => item !== combinationRoleId);
                        // Add degraded role (should not have to check)
                        let degradedRoleAdded = false;
                        let oppositeRoleAdded = false;
                        const reportedCategoryIndex = categories[category].indexOf(roleKey);
                        const newCategoryIndex: number | null = reportedCategoryIndex !== 0 ? reportedCategoryIndex - 1 : null;
                        if (newCategoryIndex === null) {
                            embedMessage = `There is no role to degrade to.`
                        } else if (newCategoryIndex >= 0) {
                            const degradedRoleKey = categories[category][newCategoryIndex];
                            const degradedRoleId = stripRole(roles[degradedRoleKey]);
                            if (!hasHigherRole(degradedRoleKey)) {
                                await user?.roles.add(degradedRoleId);
                                degradedRoleAdded = true;
                            }

                            // Add opposite role (should not have to check)
                            const oppositeRoleKey = prerequisites[roleKey][combinationKey][0];
                            const oppositeRoleId = stripRole(roles[oppositeRoleKey]);
                            if (!hasHigherRole(oppositeRoleKey)) {
                                await user?.roles.add(oppositeRoleId);
                                oppositeRoleAdded = true;
                            }
                            embedMessage = `
                            <@&${combinationRoleId}> was removed.
                            ${degradedRoleAdded ? `<@&${degradedRoleId}> was assigned.` : ''}
                            ${oppositeRoleAdded ? `<@&${oppositeRoleId}> was also assigned.` : ''}
                            `;
                            sendRoleRemovalDM(user);
                        }
                    }
                } else {
                    reportCount = reportsCount + 1;
                }
            }

            const oldTimestamp = messageEmbed.timestamp ? new Date(messageEmbed.timestamp) : new Date();
            const newEmbed = new EmbedBuilder()
                .setTimestamp(oldTimestamp)
                .setColor(messageEmbed.color)
                .setDescription(`
                ${messageContent}
                ${embedMessage ? embedMessage : ''}${dirtyReportedUserId ? `${dirtyReportedUserId} now has **${reportCount}** report${reportCount !== 1 ? 's' : ''} for ${dirtyRoleId}.\n` : ''} 
                > Report approved by <@${this.userId}> <t:${this.currentTime}:R>.`);
            if (messageEmbed.image) newEmbed.setImage(messageEmbed.image.url);
            await interaction.message.edit({ embeds: [newEmbed], components: [] })
            const replyEmbed = new EmbedBuilder()
                .setColor(this.client.util.colours.discord.green)
                .setDescription('Report successfully applied!');
            return await interaction.editReply({ embeds: [replyEmbed] });
        } else {
            this.client.logger.log(
                {
                    message: `Attempted restricted permissions. { command: Approve Report, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                    handler: this.constructor.name,
                },
                true
            );
            return await interaction.editReply({ content: 'You do not have permissions to run this command. This incident has been logged.' });
        }
    }

    private async rejectRoleAssign(interaction: ButtonInteraction<'cached'>): Promise<Message<true> | InteractionResponse<true> | void> {
        await interaction.deferReply({ ephemeral: true });

        const { hasOverridePermissions, hasRolePermissions } = this.client.util;

        const rolePermissions = await hasRolePermissions(this.client, ['admin', 'owner'], interaction);
        const overridePermissions = await hasOverridePermissions(interaction, 'assign');

        if (rolePermissions || overridePermissions) {
            const messageEmbed = interaction.message.embeds[0];
            const messageContent = messageEmbed.data.description;
            const oldTimestamp = messageEmbed.timestamp ? new Date(messageEmbed.timestamp) : new Date();
            const newEmbed = new EmbedBuilder()
                .setTimestamp(oldTimestamp)
                .setColor(messageEmbed.color)
                .setDescription(`${messageContent}\n\n> Role Rejected by <@${this.userId}> <t:${this.currentTime}:R>.`);
            const assignedRoles = messageContent?.match(/<@&\d*\>/gm)?.map(unstrippedRole => this.client.util.stripRole(unstrippedRole));
            const userIdRegex = messageContent?.match(/to <@\d*\>/gm);
            const messageIdRegex = messageContent?.match(/\[\d*\]/gm)
            let dirtyUserId;
            let dirtyMessageId;
            if (!assignedRoles) return;
            if (userIdRegex) dirtyUserId = userIdRegex[0];
            if (messageIdRegex) dirtyMessageId = messageIdRegex[0];
            if (dirtyUserId) {
                const userId = dirtyUserId.slice(5, -1);
                const user = await interaction.guild?.members.fetch(userId);
                for await (const assignedId of assignedRoles) {
                    await user.roles.remove(assignedId);
                };
            }
            if (dirtyMessageId && messageContent) {
                try {
                    const messageId = dirtyMessageId.slice(1, -1);
                    const channelId = messageContent.split('/channels/')[1].split('/')[1];
                    const channel = await interaction.guild.channels.fetch(channelId) as TextChannel;
                    const message = await channel.messages.fetch(messageId);
                    await message.delete();
                }
                catch (err) { }
            }
            await interaction.message.edit({ embeds: [newEmbed], components: [] })
            const replyEmbed = new EmbedBuilder()
                .setColor(this.client.util.colours.discord.green)
                .setDescription('Role successfully rejected!');
            return await interaction.editReply({ embeds: [replyEmbed] });
        } else {
            this.client.logger.log(
                {
                    message: `Attempted restricted permissions. { command: Reject Role Assign, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                    handler: this.constructor.name,
                },
                true
            );
            return await interaction.editReply({ content: 'You do not have permissions to run this command. This incident has been logged.' });
        }
    }
}