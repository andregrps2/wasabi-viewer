; Header image flags handled by electron-builder when installerHeader is set
!ifdef MUI_HEADERIMAGE_BITMAP
  !undef MUI_HEADERIMAGE_BITMAP
!endif
!define MUI_HEADERIMAGE_BITMAP "${BUILD_RESOURCES_DIR}/nsis-installer-header.bmp"

!ifdef MUI_WELCOMEFINISHPAGE_BITMAP
  !undef MUI_WELCOMEFINISHPAGE_BITMAP
!endif
!define MUI_WELCOMEFINISHPAGE_BITMAP "${BUILD_RESOURCES_DIR}/nsis-installer-sidebar.bmp"
!ifndef MUI_WELCOMEFINISHPAGE_BITMAP_NOSTRETCH
  !define MUI_WELCOMEFINISHPAGE_BITMAP_NOSTRETCH
!endif

; Branding text oculto pelo electron-builder quando MUI_HEADERIMAGE está ativo
;BrandingText ""

!define MUI_ABORTWARNING