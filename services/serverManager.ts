
/**
 * Gestión de Servidores para el entorno Sentinel-PTT.
 */

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
    /**
     * Implementación del método 'encrypt' para cifrado simple de credenciales.
     */
    private encrypt(text: string): string {
        try {
            // Utilizando Base64 como método de cifrado simple para demostración táctica.
            return btoa(text);
        } catch (e) {
            console.error("Error al cifrar credenciales", e);
            return text;
        }
    }
    
    /**
     * Guarda la configuración del servidor en localStorage.
     */
    public saveServerConfig(config: ServerConfig): void {
        const encryptedPass = config.password ? this.encrypt(config.password) : "";
        const id = config.id;
        
        // Guardar configuración en el almacenamiento local del navegador.
        localStorage.setItem(`server_${id}_host`, config.host);
        localStorage.setItem(`server_${id}_port`, config.port.toString());
        localStorage.setItem(`server_${id}_user`, config.username);
        localStorage.setItem(`server_${id}_pass`, encryptedPass);
    }
    
    /**
     * Descubrimiento de servidores locales (Simulado para entorno web).
     */
    public discoverLocalServers(callback: DiscoveryCallback): void {
        console.info("Sentinel: Iniciando descubrimiento de nodos en red local...");
        
        // Simulación de detección de servicio para cumplir con la interfaz original.
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
