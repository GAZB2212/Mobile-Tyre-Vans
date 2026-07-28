{pkgs}: {
  deps = [
    pkgs.libxkbcommon
    pkgs.at-spi2-core
    pkgs.cups
    pkgs.alsa-lib
    pkgs.cairo
    pkgs.pango
    pkgs.xorg.libXcursor
    pkgs.xorg.libX11
    pkgs.expat
    pkgs.mesa
    pkgs.xorg.libxcb
    pkgs.xorg.libXrandr
    pkgs.xorg.libXfixes
    pkgs.xorg.libXext
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcomposite
    pkgs.libdrm
    pkgs.at-spi2-atk
    pkgs.atk
    pkgs.dbus
    pkgs.nspr
    pkgs.nss
    pkgs.glib
  ];
}
