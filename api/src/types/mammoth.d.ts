declare module 'mammoth' {
    export interface ExtractResult {
        value: string;
        messages: any[];
    }

    export interface Options {
        path?: string;
        buffer?: Buffer;
    }

    export function extractRawText(options: Options): Promise<ExtractResult>;
}
