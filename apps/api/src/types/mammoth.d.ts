declare module "mammoth" {
  export interface Message {
    type: string;
    message: string;
  }

  export interface ExtractResult {
    value: string;
    messages: Message[];
  }

  export interface Options {
    path?: string;
    buffer?: Buffer;
  }

  export function extractRawText(options: Options): Promise<ExtractResult>;
}
