#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <psapi.h>

int main(int argc, char **argv) {
    if (argc < 2) return 1;
    DWORD pid = (DWORD)strtoul(argv[1], NULL, 10);
    unsigned long long limit_kb = argc > 2 ? strtoull(argv[2], NULL, 10) : 0ULL;

    HANDLE h = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, pid);
    if (!h) return 2;

    unsigned long long peak = 0;
    int over = 0;
    PROCESS_MEMORY_COUNTERS pmc;

    for (;;) {
        if (GetProcessMemoryInfo(h, &pmc, sizeof(pmc))) {
            unsigned long long pk = (unsigned long long)pmc.PeakWorkingSetSize / 1024ULL;
            if (pk > peak) peak = pk;
            if (limit_kb && (unsigned long long)pmc.WorkingSetSize / 1024ULL > limit_kb) over = 1;
        }
        DWORD code = 0;
        if (!GetExitCodeProcess(h, &code) || code != STILL_ACTIVE) break;
        if (over) {
            printf("%llu EXCEEDED\n", peak);
            fflush(stdout);
            CloseHandle(h);
            return 42;
        }
        Sleep(25);
    }

    if (GetProcessMemoryInfo(h, &pmc, sizeof(pmc))) {
        unsigned long long pk = (unsigned long long)pmc.PeakWorkingSetSize / 1024ULL;
        if (pk > peak) peak = pk;
        if (limit_kb && pk > limit_kb) over = 1;
    }
    CloseHandle(h);

    if (over) {
        printf("%llu EXCEEDED\n", peak);
        return 42;
    }
    printf("%llu\n", peak);
    return 0;
}
