declare module 'mjml' {
  interface MJMLParsingOptions {
    [key: string]: unknown;
  }

  interface MJMLParseError {
    line: number;
    message: string;
    tagName?: string;
    formattedMessage?: string;
  }

  interface MJMLParseResults {
    html: string;
    errors: MJMLParseError[];
  }

  export default function mjml2html(
    input: string,
    options?: MJMLParsingOptions,
  ): MJMLParseResults;
}
