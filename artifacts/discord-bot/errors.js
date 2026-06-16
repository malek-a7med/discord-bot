export class BotError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'BotError';
    this.code = code;
  }
}

export class GoogleDriveError extends BotError {
  constructor(message) {
    super(message, 'GOOGLE_DRIVE_ERROR');
    this.name = 'GoogleDriveError';
  }
}

export class GoogleDocsError extends BotError {
  constructor(message) {
    super(message, 'GOOGLE_DOCS_ERROR');
    this.name = 'GoogleDocsError';
  }
}

export class ImageProcessingError extends BotError {
  constructor(message) {
    super(message, 'IMAGE_PROCESSING_ERROR');
    this.name = 'ImageProcessingError';
  }
}

export class MusicStreamError extends BotError {
  constructor(message) {
    super(message, 'MUSIC_STREAM_ERROR');
    this.name = 'MusicStreamError';
  }
}

export class ModerationError extends BotError {
  constructor(message) {
    super(message, 'MODERATION_ERROR');
    this.name = 'ModerationError';
  }
}

export class VoiceChannelError extends BotError {
  constructor(message) {
    super(message, 'VOICE_CHANNEL_ERROR');
    this.name = 'VoiceChannelError';
  }
}
