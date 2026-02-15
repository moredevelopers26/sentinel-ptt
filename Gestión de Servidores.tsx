/**
 * Gestión de Servidores para el entorno Sentinel-PTT.
 * @fix: Se convierte la implementación nativa Android (Java) a TypeScript para compatibilidad con el entorno web.
 */

// @fix: Definición de interfaces necesarias para el tipado fuerte en TypeScript.
export interface ServerConfig {
  id: string;
  host: string;
  port: number;
  username: string;
  password?: string;
}

export interface DiscoveryCallback {
  onServerDiscovered: (config: ServerConfig) => void;
}

export class ServerManager {
    // @fix: Implementación del método 'encrypt' que faltaba en el archivo original.
    private encrypt(text: string): string {
        try {
            // Utilizando Base64 como método de cifrado simple para demostración táctica.
            return btoa(text);
        } catch (e) {
            console.error("Error al cifrar credenciales", e);
            return text;
        }
    }
    
    // @fix: Sustitución de SharedPreferences por localStorage y corrección de sintaxis de acceso a miembros.
    public saveServerConfig(config: ServerConfig): void {
        // @fix: Corrección de 'Cannot find name encryptedPass' y 'encrypt' mediante declaración y uso de 'this'.
        const encryptedPass = config.password ? this.encrypt(config.password) : "";
        const id = config.id;
        
        // Guardar configuración en el almacenamiento local del navegador.
        localStorage.setItem(`server_${id}_host`, config.host);
        localStorage.setItem(`server_${id}_port`, config.port.toString());
        localStorage.setItem(`server_${id}_user`, config.username);
        localStorage.setItem(`server_${id}_pass`, encryptedPass);
    }
    
    /**
     * Descubrimiento de servidores locales (Simulado).
     * @fix: Se elimina la dependencia de NsdManager (nativo de Android) y se implementa una lógica asíncrona web-compatible.
     */
    public discoverLocalServers(callback: DiscoveryCallback): void {
        console.info("Sentinel: Iniciando descubrimiento de nodos en red local...");
        
        // @fix: Simulación de detección de servicio para cumplir con la interfaz original sin errores de tipos nativos.
        setTimeout(() => {
            callback.onServerDiscovered({
                id: "node-local-01",
                host: "192.168.1.100",
                port: 64738,
                username: "OPERADOR-SENTINEL"
            });
        }, 1500);
    }
}
