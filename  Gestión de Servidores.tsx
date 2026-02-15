public class ServerManager {
    private SharedPreferences prefs;
    
    public void saveServerConfig(ServerConfig config) {
        // Guardar configuración cifrada
        String encryptedPass = encrypt(config.getPassword());
        
        prefs.edit()
            .putString("server_" + config.getId() + "_host", config.getHost())
            .putInt("server_" + config.getId() + "_port", config.getPort())
            .putString("server_" + config.getId() + "_user", config.getUsername())
            .putString("server_" + config.getId() + "_pass", encryptedPass)
            .apply();
    }
    
    /**
     * Descubrimiento de servidores locales (Bonjour/Zeroconf)
     */
    public void discoverLocalServers(DiscoveryCallback callback) {
        NsdManager nsdManager = (NsdManager) context.getSystemService(Context.NSD_SERVICE);
        nsdManager.discoverServices("_mumble._tcp", NsdManager.PROTOCOL_DNS_SD, 
            new NsdManager.DiscoveryListener() {
                @Override
                public void onServiceFound(NsdServiceInfo serviceInfo) {
                    callback.onServerDiscovered(new ServerConfig(
                        serviceInfo.getHost(),
                        serviceInfo.getPort()
                    ));
                }
            });
    }
}