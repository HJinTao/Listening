import fs from 'fs';
import path from 'path';

export interface Plugin {
  id: string;
  name: string;
  search: (keyword: string, page: number, limit: number) => Promise<{ list: any[] }>;
  getMusicUrl: (songId: string, quality: string) => Promise<string>;
  getLyric: (songId: string, extra?: any) => Promise<{ lyric: string; tlyric?: string }>;
  getPic: (songId: string, albumId?: string, extra?: any) => Promise<string>;
}

class PluginManager {
  private plugins: Map<string, Plugin> = new Map();

  constructor() {
    this.loadPlugins();
  }

  private loadPlugins() {
    const pluginsDir = path.join(__dirname, '../../plugins');
    if (!fs.existsSync(pluginsDir)) {
      console.warn(`Plugins directory not found: ${pluginsDir}`);
      return;
    }

    const files = fs.readdirSync(pluginsDir);
    for (const file of files) {
      if (file.endsWith('.js')) {
        try {
          const pluginPath = path.join(pluginsDir, file);
          // Delete cache to allow reloading
          delete require.cache[require.resolve(pluginPath)];
          const plugin = require(pluginPath);
          
          if (this.isValidPlugin(plugin)) {
            this.plugins.set(plugin.id, plugin);
            console.log(`Loaded plugin: ${plugin.name} (${plugin.id})`);
          } else {
            console.warn(`Invalid plugin format: ${file}`);
          }
        } catch (error: any) {
          console.error(`Failed to load plugin ${file}:`, error.message);
        }
      }
    }
  }

  private isValidPlugin(plugin: any): plugin is Plugin {
    return (
      plugin &&
      typeof plugin.id === 'string' &&
      typeof plugin.name === 'string' &&
      typeof plugin.search === 'function' &&
      typeof plugin.getMusicUrl === 'function' &&
      typeof plugin.getLyric === 'function' &&
      typeof plugin.getPic === 'function'
    );
  }

  public getPlugin(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }

  public getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }
  
  public reloadPlugins() {
    this.plugins.clear();
    this.loadPlugins();
  }
}

export default new PluginManager();
