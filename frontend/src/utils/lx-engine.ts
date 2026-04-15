import axios from 'axios';
import { Buffer } from 'buffer';
// @ts-ignore
import md5 from 'md5';

export class LxEngine {
  private events: Record<string, Function> = {};
  public isInited = false;
  public sources: any = {};
  public version = '2.0.0';
  public env = 'desktop';

  private backendUrl: string;

  constructor(backendUrl: string) {
    this.backendUrl = backendUrl;
  }

  public getGlobalThisLx() {
    return {
      EVENT_NAMES: {
        request: 'request',
        inited: 'inited',
        updateAlert: 'updateAlert',
      },
      request: (url: string, options: any, callback: Function) => {
        const { method = 'get', headers, body, form, formData, timeout } = options;
        let data = body || form || formData;

        axios.post(`${this.backendUrl}/api/proxy`, {
          url,
          method,
          headers,
          body: data,
        }, {
          timeout: typeof timeout === 'number' && timeout > 0 ? timeout : 60000,
          validateStatus: () => true
        }).then((response) => {
          const resp = {
            statusCode: response.data.statusCode,
            statusMessage: response.data.statusMessage,
            headers: response.data.headers,
            body: response.data.body,
            raw: JSON.stringify(response.data.body)
          };
          callback(null, resp, response.data.body);
        }).catch((error) => {
          callback(error, null, null);
        });

        return () => {
          console.log('Request aborted');
        };
      },
      send: (eventName: string, data: any) => {
        return new Promise<void>((resolve, reject) => {
          if (eventName === 'inited') {
            this.isInited = true;
            this.sources = data.sources;
            console.log('LXMUSIC Engine initialized with sources:', this.sources);
            resolve();
          } else if (eventName === 'updateAlert') {
            console.log('Update Alert:', data);
            resolve();
          } else {
            reject(new Error('Unknown event name: ' + eventName));
          }
        });
      },
      on: (eventName: string, handler: Function) => {
        this.events[eventName] = handler;
        return Promise.resolve();
      },
      utils: {
        crypto: {
          aesEncrypt: () => Buffer.from([]),
          rsaEncrypt: () => Buffer.from([]),
          randomBytes: (size: number) => new Uint8Array(size),
          md5: (str: string) => md5(str)
        },
        buffer: {
          from: (...args: any[]) => Buffer.from(args[0]),
          bufToString: (buf: any, format: string) => Buffer.from(buf, 'binary').toString(format as any)
        }
      },
      version: this.version,
      env: this.env
    };
  }

  public loadScript(scriptContent: string) {
    try {
      const lx = this.getGlobalThisLx();
      
      const mockGlobalThis = {
        lx,
        console: { ...console }
      };

      // Ensure `globalThis.lx` is available inside the Function sandbox
      const wrapper = new Function('globalThis', `
        const lx = globalThis.lx;
        ${scriptContent}
      `);
      
      wrapper(mockGlobalThis);
      return true;
    } catch (error) {
      console.error('Failed to load LXMUSIC script:', error);
      return false;
    }
  }

  public async requestMusicUrl(source: string, musicInfo: any, quality: string): Promise<string> {
    if (!this.events['request']) {
      throw new Error('Request event handler not registered by script');
    }

    return new Promise((resolve, reject) => {
      this.events['request']({
        action: 'musicUrl',
        source,
        info: {
          type: quality,
          musicInfo
        }
      }).then((response: any) => {
        resolve(response);
      }).catch((error: any) => {
        reject(error);
      });
    });
  }
}
