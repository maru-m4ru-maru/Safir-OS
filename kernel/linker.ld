ENTRY(rust_main)

SECTIONS
{
    . = 0x11000;

    .text : ALIGN(16)
    {
        KEEP(*(.text.rust_main))
        *(.text*)
    }

    .rodata : ALIGN(16)
    {
        *(.rodata*)
    }

    .data : ALIGN(16)
    {
        *(.data*)
    }

    .bss : ALIGN(16)
    {
        *(COMMON)
        *(.bss*)
    }

    /DISCARD/ :
    {
        *(.eh_frame*)
        *(.comment*)
        *(.note*)
    }

    ASSERT(ADDR(.text) == 0x11000, "Rust text must start at 0x11000")
}
