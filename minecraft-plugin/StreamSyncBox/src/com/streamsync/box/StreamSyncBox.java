package com.streamsync.box;

import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.Color;
import org.bukkit.FireworkEffect;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.boss.BarColor;
import org.bukkit.boss.BarStyle;
import org.bukkit.boss.BossBar;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Firework;
import org.bukkit.entity.Player;
import org.bukkit.entity.TNTPrimed;
import org.bukkit.inventory.meta.FireworkMeta;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitRunnable;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Random;

/**
 * StreamSyncBox — reemplazo libre (sin licencia) del plugin "BedrockBox" de S2E.
 *
 * Registra el comando /bedrock con los mismos subcomandos que StreamSync ya
 * dispara desde la consola cuando llega un regalo de TikTok. Un jugador crea la
 * caja una vez con /bedrock create (define la posición) y a partir de ahí los
 * comandos de consola (tnt, randomtnt, supertnt, glass_prison...) actúan sobre
 * esa caja guardada — exactamente el flujo que usa el panel de Minecraft.
 */
public class StreamSyncBox extends JavaPlugin implements CommandExecutor {

    private String worldName;
    private int cx, cy, cz, radius, height;
    private boolean hasBox = false;

    private final Material[] FILL = {
        Material.RED_WOOL, Material.ORANGE_WOOL, Material.YELLOW_WOOL,
        Material.LIME_WOOL, Material.LIGHT_BLUE_WOOL, Material.PINK_WOOL,
        Material.MAGENTA_WOOL, Material.CYAN_WOOL
    };
    private final Random rnd = new Random();

    private BossBar activeBar;
    private BukkitRunnable activeTimer;

    @Override
    public void onEnable() {
        // No usamos saveDefaultConfig(): no hay config.yml embebido. getConfig()
        // devuelve uno vacío y saveConfig() lo crea cuando guardamos la caja.
        loadBox();
        if (getCommand("bedrock") != null) {
            getCommand("bedrock").setExecutor(this);
        }
        getLogger().info("StreamSyncBox activo. Caja: "
            + (hasBox ? worldName + " " + cx + "," + cy + "," + cz : "sin crear (usa /bedrock create)"));
    }

    @Override
    public void onDisable() {
        if (activeTimer != null) { activeTimer.cancel(); activeTimer = null; }
        if (activeBar != null) { activeBar.removeAll(); activeBar = null; }
    }

    // ───────────────────────── persistencia de la caja ─────────────────────────

    private void loadBox() {
        if (getConfig().getBoolean("box.set", false)) {
            worldName = getConfig().getString("box.world", "world");
            cx = getConfig().getInt("box.x");
            cy = getConfig().getInt("box.y");
            cz = getConfig().getInt("box.z");
            radius = getConfig().getInt("box.radius", 2);
            height = getConfig().getInt("box.height", 12);
            hasBox = true;
        }
    }

    private void saveBox() {
        getConfig().set("box.set", hasBox);
        getConfig().set("box.world", worldName);
        getConfig().set("box.x", cx);
        getConfig().set("box.y", cy);
        getConfig().set("box.z", cz);
        getConfig().set("box.radius", radius);
        getConfig().set("box.height", height);
        saveConfig();
    }

    private World world() {
        World w = worldName == null ? null : Bukkit.getWorld(worldName);
        if (w == null && !Bukkit.getWorlds().isEmpty()) w = Bukkit.getWorlds().get(0);
        return w;
    }

    // ───────────────────────────── enrutado ─────────────────────────────

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 0) {
            sender.sendMessage("§6/bedrock create|fill|clear|delete|tp|tnt|randomtnt|supertnt|glass_prison|glass|wood|rock|fireworks|timer");
            return true;
        }
        String sub = args[0].toLowerCase(Locale.ROOT);
        switch (sub) {
            case "create": return doCreate(sender, args);
            case "fill": return doFill(sender, args);
            case "clear": return doClear(sender);
            case "delete": return doDelete(sender);
            case "tp": return doTp(sender);
            case "tnt": return doTnt(sender, args);
            case "randomtnt": return doRandomTnt(sender);
            case "supertnt": return doSuperTnt(sender, args);
            case "glass_prison":
            case "glassprison": return doGlassPrison(sender, args);
            case "glass": return setWalls(sender, Material.GLASS);
            case "wood": return setWalls(sender, Material.OAK_PLANKS);
            case "rock": return setWalls(sender, Material.BEDROCK);
            case "walls": {
                Material m = args.length >= 2 ? Material.matchMaterial(args[1].toUpperCase(Locale.ROOT)) : Material.BEDROCK;
                return setWalls(sender, m != null && m.isBlock() ? m : Material.BEDROCK);
            }
            case "fireworks": return doFireworks(sender);
            case "timer": return doTimer(sender, args);
            default:
                sender.sendMessage("§cSubcomando desconocido: " + sub);
                return true;
        }
    }

    private boolean requireBox(CommandSender s) {
        if (!hasBox) {
            s.sendMessage("§cNo hay caja. Un jugador debe usar §e/bedrock create§c primero.");
            return false;
        }
        return true;
    }

    // ───────────────────────────── comandos ─────────────────────────────

    private boolean doCreate(CommandSender sender, String[] args) {
        // La caja se fija en la posición de un jugador. Si lo llama un jugador,
        // la suya; si lo llama la consola (botón del panel), la del primer
        // jugador conectado.
        Player ref = (sender instanceof Player) ? (Player) sender : firstOnline();
        if (ref == null) {
            sender.sendMessage("§cEntra al juego primero para fijar la posición de la caja.");
            return true;
        }
        int size = args.length >= 2 ? clampInt(args[1], 5, 3, 31) : 5;
        int h = args.length >= 3 ? clampInt(args[2], 12, 9, 21) : 12;
        radius = size / 2;
        height = h;
        Location base = ref.getLocation().getBlock().getLocation();
        worldName = base.getWorld().getName();
        cx = base.getBlockX();
        cy = base.getBlockY();
        cz = base.getBlockZ();
        hasBox = true;
        buildBox();
        saveBox();
        ref.teleport(new Location(world(), cx + 0.5, cy, cz + 0.5));
        sender.sendMessage("§a✔ Caja creada (" + (radius * 2 + 1) + "x" + (radius * 2 + 1) + ", alto " + height + ").");
        ref.sendMessage("§a✔ Caja StreamSync creada bajo tus pies.");
        return true;
    }

    private Player firstOnline() {
        for (Player p : Bukkit.getOnlinePlayers()) return p;
        return null;
    }

    private void buildBox() {
        World w = world();
        if (w == null) return;
        int floorY = cy - 1;
        for (int x = cx - radius; x <= cx + radius; x++) {
            for (int z = cz - radius; z <= cz + radius; z++) {
                w.getBlockAt(x, floorY, z).setType(Material.BEDROCK);
            }
        }
        for (int y = cy; y < cy + height; y++) {
            for (int x = cx - radius; x <= cx + radius; x++) {
                for (int z = cz - radius; z <= cz + radius; z++) {
                    if (isWall(x, z)) w.getBlockAt(x, y, z).setType(Material.BEDROCK);
                }
            }
        }
    }

    private boolean isWall(int x, int z) {
        return x == cx - radius || x == cx + radius || z == cz - radius || z == cz + radius;
    }

    private boolean setWalls(CommandSender sender, Material mat) {
        if (!requireBox(sender)) return true;
        World w = world();
        if (w == null) return true;
        for (int y = cy; y < cy + height; y++) {
            for (int x = cx - radius; x <= cx + radius; x++) {
                for (int z = cz - radius; z <= cz + radius; z++) {
                    if (isWall(x, z)) w.getBlockAt(x, y, z).setType(mat);
                }
            }
        }
        sender.sendMessage("§aParedes → " + mat);
        return true;
    }

    private boolean doFill(CommandSender sender, String[] args) {
        if (!requireBox(sender)) return true;
        World w = world();
        if (w == null) return true;
        int rows = args.length >= 2 ? clampInt(args[1], height, 1, height) : height;
        int top = cy + rows - 1;
        for (int y = cy; y <= top; y++) {
            for (int x = cx - radius + 1; x <= cx + radius - 1; x++) {
                for (int z = cz - radius + 1; z <= cz + radius - 1; z++) {
                    w.getBlockAt(x, y, z).setType(FILL[rnd.nextInt(FILL.length)]);
                }
            }
        }
        sender.sendMessage("§aCaja llena (" + rows + " filas).");
        return true;
    }

    private boolean doClear(CommandSender sender) {
        if (!requireBox(sender)) return true;
        World w = world();
        if (w == null) return true;
        for (int y = cy; y < cy + height; y++) {
            for (int x = cx - radius + 1; x <= cx + radius - 1; x++) {
                for (int z = cz - radius + 1; z <= cz + radius - 1; z++) {
                    w.getBlockAt(x, y, z).setType(Material.AIR);
                }
            }
        }
        sender.sendMessage("§aCaja vaciada.");
        return true;
    }

    private boolean doDelete(CommandSender sender) {
        if (!requireBox(sender)) return true;
        World w = world();
        if (w != null) {
            for (int y = cy - 1; y < cy + height; y++) {
                for (int x = cx - radius; x <= cx + radius; x++) {
                    for (int z = cz - radius; z <= cz + radius; z++) {
                        w.getBlockAt(x, y, z).setType(Material.AIR);
                    }
                }
            }
        }
        hasBox = false;
        saveBox();
        sender.sendMessage("§aCaja eliminada.");
        return true;
    }

    private boolean doTp(CommandSender sender) {
        if (!requireBox(sender)) return true;
        World w = world();
        if (w == null) return true;
        Location top = new Location(w, cx + 0.5, cy + height + 1, cz + 0.5);
        if (sender instanceof Player) {
            ((Player) sender).teleport(top);
        } else {
            for (Player p : w.getPlayers()) p.teleport(top);
        }
        return true;
    }

    private boolean doTnt(CommandSender sender, String[] args) {
        if (!requireBox(sender)) return true;
        String name = args.length >= 2 ? joinFrom(args, 1) : null;
        spawnTnt(name, 4f);
        return true;
    }

    private boolean doRandomTnt(CommandSender sender) {
        if (!requireBox(sender)) return true;
        spawnTnt(null, 2f + rnd.nextInt(5)); // 2..6
        return true;
    }

    private boolean doSuperTnt(CommandSender sender, String[] args) {
        if (!requireBox(sender)) return true;
        int count = args.length >= 2 ? clampInt(args[1], 1, 1, 10) : 1;
        float strength = args.length >= 3 ? clampInt(args[2], 4, 1, 8) : 4;
        for (int i = 0; i < count; i++) spawnTnt(null, strength);
        return true;
    }

    private void spawnTnt(String name, float yield) {
        World w = world();
        if (w == null) return;
        double[] off = randomOffset();
        Location loc = new Location(w, cx + 0.5 + off[0], cy + height + 3, cz + 0.5 + off[1]);
        TNTPrimed tnt = w.spawn(loc, TNTPrimed.class);
        tnt.setFuseTicks(50);
        tnt.setYield(Math.min(yield, 8f));
        tnt.setIsIncendiary(false);
        if (name != null && !name.isEmpty()) {
            tnt.customName(Component.text(name));
            tnt.setCustomNameVisible(true);
        }
    }

    private boolean doGlassPrison(CommandSender sender, String[] args) {
        if (!requireBox(sender)) return true;
        int seconds = args.length >= 2 ? clampInt(args[1], 5, 1, 60) : 5;
        Player target = nearestPlayer();
        if (target == null) {
            sender.sendMessage("§cNo hay jugadores cerca de la caja para encarcelar.");
            return true;
        }
        final List<Location> cage = buildGlassCage(target.getLocation());
        target.sendMessage("§b🔒 ¡Glass prison por " + seconds + "s!");
        new BukkitRunnable() {
            @Override
            public void run() {
                for (Location l : cage) {
                    if (l.getBlock().getType() == Material.GLASS) l.getBlock().setType(Material.AIR);
                }
            }
        }.runTaskLater(this, seconds * 20L);
        return true;
    }

    private List<Location> buildGlassCage(Location feet) {
        World w = feet.getWorld();
        int px = feet.getBlockX(), py = feet.getBlockY(), pz = feet.getBlockZ();
        List<Location> changed = new ArrayList<>();
        int[][] ring = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}, {1, 1}, {1, -1}, {-1, 1}, {-1, -1}};
        for (int dy = 0; dy <= 1; dy++) {
            for (int[] o : ring) setGlass(w, px + o[0], py + dy, pz + o[1], changed);
        }
        setGlass(w, px, py - 1, pz, changed);
        setGlass(w, px, py + 2, pz, changed);
        return changed;
    }

    private void setGlass(World w, int x, int y, int z, List<Location> acc) {
        Block b = w.getBlockAt(x, y, z);
        if (b.getType().isAir()) {
            b.setType(Material.GLASS);
            acc.add(b.getLocation());
        }
    }

    private boolean doFireworks(CommandSender sender) {
        if (!requireBox(sender)) return true;
        World w = world();
        if (w == null) return true;
        for (int i = 0; i < 4; i++) {
            double[] off = randomOffset();
            Location loc = new Location(w, cx + 0.5 + off[0], cy + 1, cz + 0.5 + off[1]);
            Firework fw = w.spawn(loc, Firework.class);
            FireworkMeta meta = fw.getFireworkMeta();
            meta.addEffect(FireworkEffect.builder()
                .withColor(Color.fromRGB(rnd.nextInt(0xFFFFFF)))
                .with(FireworkEffect.Type.BALL_LARGE)
                .withFlicker()
                .withTrail()
                .build());
            meta.setPower(1);
            fw.setFireworkMeta(meta);
        }
        return true;
    }

    private boolean doTimer(CommandSender sender, String[] args) {
        if (!requireBox(sender)) return true;
        final int seconds = args.length >= 2 ? clampInt(args[1], 60, 1, 600) : 60;
        if (activeTimer != null) { activeTimer.cancel(); activeTimer = null; }
        if (activeBar != null) { activeBar.removeAll(); activeBar = null; }

        final BossBar bar = Bukkit.createBossBar("Tiempo: " + seconds + "s", BarColor.PURPLE, BarStyle.SOLID);
        for (Player p : Bukkit.getOnlinePlayers()) bar.addPlayer(p);
        bar.setVisible(true);
        activeBar = bar;

        activeTimer = new BukkitRunnable() {
            int left = seconds;

            @Override
            public void run() {
                left--;
                if (left <= 0) {
                    bar.setTitle("¡TIEMPO!");
                    bar.setProgress(0);
                    Bukkit.broadcastMessage("§d§l¡Se acabó el tiempo de la caja!");
                    cancel();
                    final BossBar toClose = bar;
                    new BukkitRunnable() {
                        @Override
                        public void run() { toClose.removeAll(); }
                    }.runTaskLater(StreamSyncBox.this, 60L);
                    activeTimer = null;
                    activeBar = null;
                    return;
                }
                bar.setTitle("Tiempo: " + left + "s");
                bar.setProgress(Math.max(0.0, Math.min(1.0, (double) left / seconds)));
            }
        };
        activeTimer.runTaskTimer(this, 20L, 20L);
        sender.sendMessage("§aTimer iniciado: " + seconds + "s");
        return true;
    }

    // ───────────────────────────── helpers ─────────────────────────────

    private Player nearestPlayer() {
        World w = world();
        if (w == null) return null;
        Location c = new Location(w, cx + 0.5, cy + 1, cz + 0.5);
        Player best = null;
        double bd = Double.MAX_VALUE;
        for (Player p : w.getPlayers()) {
            double d = p.getLocation().distanceSquared(c);
            if (d < bd) { bd = d; best = p; }
        }
        return best;
    }

    private double[] randomOffset() {
        int r = Math.max(0, radius - 1);
        double dx = r == 0 ? 0 : (rnd.nextInt(r * 2 + 1) - r);
        double dz = r == 0 ? 0 : (rnd.nextInt(r * 2 + 1) - r);
        return new double[]{dx, dz};
    }

    private int clampInt(String s, int def, int min, int max) {
        try {
            int v = Integer.parseInt(s.trim());
            return Math.max(min, Math.min(max, v));
        } catch (Exception e) {
            return def;
        }
    }

    private String joinFrom(String[] a, int start) {
        StringBuilder sb = new StringBuilder();
        for (int i = start; i < a.length; i++) {
            if (i > start) sb.append(' ');
            sb.append(a[i]);
        }
        return sb.toString();
    }
}
