// Source: https://github.com/dotnet/runtime/blob/7b8b0c6661375d5eb2dad119ee017041f642ded8/src/libraries/System.Private.CoreLib/src/System/Double.cs  (lines 9-33 trimmed, 169-199, 989-1010, 1141-1150)
// Copyright (c) .NET Foundation and Contributors. Licensed under MIT. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — struct trimmed to five members (interface list dropped, removed members replaced by "// ... (omitted)"); annotation comments added.
using System.Runtime.CompilerServices;
using System.Runtime.Versioning;

namespace System
{
    public readonly struct Double
    {
        // ... (omitted)

        /// <summary>Determines whether the specified value is finite (zero, subnormal, or normal).</summary>
        /// <remarks>This effectively checks the value is not NaN and not infinite.</remarks>
        [NonVersionable]
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static bool IsFinite(double d)
        {
            ulong bits = BitConverter.DoubleToUInt64Bits(d);
            // ok: self-comparison
            return (~bits & PositiveInfinityBits) != 0;
        }

        /// <summary>Determines whether the specified value is infinite.</summary>
        [NonVersionable]
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static bool IsInfinity(double d)
        {
            ulong bits = BitConverter.DoubleToUInt64Bits(Abs(d));
            return bits == PositiveInfinityBits;
        }

        /// <summary>Determines whether the specified value is NaN.</summary>
        [NonVersionable]
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static bool IsNaN(double d)
        {
            // A NaN will never equal itself so this is an
            // easy and efficient way to check for NaN.

            #pragma warning disable CS1718
            // ruleid: self-comparison
            return d != d;
            #pragma warning restore CS1718
        }

        // ... (omitted)

        /// <inheritdoc cref="INumber{TSelf}.MaxNumber(TSelf, TSelf)" />
        [Intrinsic]
        public static double MaxNumber(double x, double y)
        {
            // This matches the IEEE 754:2019 `maximumNumber` function
            //
            // It does not propagate NaN inputs back to the caller and
            // otherwise returns the larger of the inputs. It
            // treats +0 as larger than -0 as per the specification.

            // ok: self-comparison
            if (x != y)
            {
                if (!IsNaN(y))
                {
                    return y < x ? x : y;
                }

                return x;
            }

            return IsNegative(y) ? x : y;
        }

        // ... (omitted)

        /// <inheritdoc cref="INumberBase{TSelf}.IsRealNumber(TSelf)" />
        public static bool IsRealNumber(double value)
        {
            // A NaN will never equal itself so this is an
            // easy and efficient way to check for a real number.

#pragma warning disable CS1718
            return value == value;
#pragma warning restore CS1718
        }
    }
}
