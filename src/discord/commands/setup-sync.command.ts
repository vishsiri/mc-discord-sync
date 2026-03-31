import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import type { ButtonContext, ModalContext, SlashCommandContext } from 'necord';
import { Button, Context, Modal, SlashCommand } from 'necord';
import { RedisService } from '../../redis/redis.service';
import { SyncService } from '../../sync/sync.service';

@Injectable()
export class SetupSyncCommand {
  private readonly logger = new Logger(SetupSyncCommand.name);

  constructor(
    private readonly syncService: SyncService,
    private readonly redisService: RedisService,
    private readonly config: ConfigService,
  ) {}

  @SlashCommand({
    name: 'setupsync',
    description: 'สร้างแผงเชื่อมต่อบัญชี Minecraft กับ Discord',
    defaultMemberPermissions: ['Administrator'],
  })
  async onSetupSync(@Context() [interaction]: SlashCommandContext) {
    const embed = new EmbedBuilder()
      .setTitle('🔗 เชื่อมต่อบัญชี Minecraft')
      .setDescription(
        'กดปุ่มด้านล่างและกรอกรหัสยืนยันที่ได้จากการพิมพ์ `/sync` ในเกม\n\n' +
          '**วิธีใช้:**\n' +
          '1. พิมพ์ `/sync` ในเซิร์ฟเวอร์ Minecraft\n' +
          '2. รับรหัส 5 ตัวอักษร\n' +
          '3. กดปุ่ม **เชื่อมต่อบัญชี** ด้านล่าง\n' +
          '4. กรอกรหัสที่ได้รับ',
      )
      .setColor(0x5865f2)
      .setFooter({ text: 'minedream Discord Sync' });

    const button = new ButtonBuilder()
      .setCustomId('sync_button')
      .setLabel('เชื่อมต่อบัญชี')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔗');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    await interaction.reply({ embeds: [embed], components: [row] });
  }

  @Button('sync_button')
  async onSyncButton(@Context() [interaction]: ButtonContext) {
    const modal = new ModalBuilder()
      .setCustomId('sync_modal')
      .setTitle('กรอกรหัสยืนยัน');

    const codeInput = new TextInputBuilder()
      .setCustomId('sync_code')
      .setLabel('รหัสยืนยัน (จาก /sync ในเกม)')
      .setStyle(TextInputStyle.Short)
      .setMinLength(5)
      .setMaxLength(5)
      .setPlaceholder('เช่น A7X9Q')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(codeInput),
    );

    await interaction.showModal(modal);
  }

  @Modal('sync_modal')
  async onSyncModal(@Context() [interaction]: ModalContext) {
    await interaction.deferReply({ ephemeral: true });

    const code = interaction.fields
      .getTextInputValue('sync_code')
      .trim()
      .toUpperCase();
    const discordId = interaction.user.id;

    try {
      const result = await this.syncService.verifyCode(discordId, code);

      const member = interaction.member as GuildMember;
      if (member) {
        await this.applyDiscordActions(member, result.minecraftName);
      }

      await this.redisService.publishSyncSuccess({
        minecraftUuid: result.minecraftUuid,
        minecraftName: result.minecraftName,
        discordId: result.discordId,
      });

      if (member && this.isBoostRewardEnabled()) {
        await this.handleBoostRewardAfterSync(member, result);
      }

      const successEmbed = new EmbedBuilder()
        .setTitle('✅ เชื่อมต่อบัญชีสำเร็จ!')
        .setDescription(
          `บัญชี Minecraft \`${result.minecraftName}\` ถูกเชื่อมต่อกับ Discord ของคุณแล้ว`,
        )
        .setColor(0x57f287)
        .setThumbnail(
          `https://mineskin.eu/helm/${result.minecraftName}/100.png`,
        )
        .setFooter({ text: 'minedream Discord Sync' });

      await interaction.editReply({ embeds: [successEmbed] });

      this.logger.log(
        `Sync success: ${result.minecraftName} <-> ${discordId}`,
      );
    } catch (error) {
      const message =
        error?.status === 404
          ? '❌ รหัสไม่ถูกต้องหรือหมดอายุแล้ว กรุณาพิมพ์ `/sync` ในเกมอีกครั้ง'
          : error?.status === 401
            ? '⚠️ บัญชีนี้ถูกเชื่อมต่อไปแล้ว'
            : '❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';

      await interaction.editReply({ content: message });
    }
  }

  private async applyDiscordActions(member: GuildMember, minecraftName: string) {
    const syncedRoleId = this.config.get<string>('DISCORD_SYNCED_ROLE_ID');
    const removeRoleId = this.config.get<string>('DISCORD_REMOVE_ROLE_ID');
    const enableNicknameSync = this.config.get<string>(
      'ENABLE_NICKNAME_SYNC',
      'false',
    );
    const nicknameFormat = this.config.get<string>(
      'NICKNAME_FORMAT',
      '{ign}',
    );

    try {
      if (syncedRoleId) {
        await member.roles.add(syncedRoleId);
      }

      if (removeRoleId) {
        await member.roles.remove(removeRoleId).catch(() => {});
      }

      if (enableNicknameSync === 'true') {
        const nickname = nicknameFormat.replace('{ign}', minecraftName);
        await member.setNickname(nickname).catch((err) =>
          this.logger.warn(`Cannot set nickname: ${err.message}`),
        );
      }
    } catch (err) {
      this.logger.error('Failed to apply Discord actions', err);
    }
  }

  private isBoostRewardEnabled(): boolean {
    return this.config.get<string>('ENABLE_BOOST_REWARDS', 'false') === 'true';
  }

  private async handleBoostRewardAfterSync(
    member: GuildMember,
    result: { minecraftUuid: string; minecraftName: string; discordId: string },
  ) {
    if (!member.premiumSinceTimestamp) {
      return;
    }

    const boostRewardRoleId = this.config.get<string>('DISCORD_BOOST_REWARD_ROLE_ID');
    if (boostRewardRoleId) {
      await member.roles.add(boostRewardRoleId).catch((err) =>
        this.logger.warn(`Cannot add boost reward role: ${err.message}`),
      );
    }

    await this.redisService.publishBoostReward({
      minecraftUuid: result.minecraftUuid,
      minecraftName: result.minecraftName,
      discordId: result.discordId,
      boosted: true,
    });
  }
}
