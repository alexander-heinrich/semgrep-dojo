// Source: https://github.com/CodeThreat/IssueBlot.NET/blob/06f33f75ec5f3e36594f32e5413d8d4fd64282b0/src/NETMVCBlot/Repository/BillRepository.cs  (lines 1-71, 84)
// Copyright (c) 2023 CodeThreat. Licensed under MIT. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: no
using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Entity;
using System.Data.SqlClient;
using System.Linq;
using System.Web;

namespace NETMVCBlot.Repository
{
    public class BillRepository
    {
        public Bill GetBill(int id)
        {
            // CTSECISSUE: UnsafeDatabaseResourceRelease
            // ruleid: sql-connection-opened
            SqlConnection conn = new SqlConnection("");
            // CTSECISSUE: UnsafeDatabaseResourceRelease
            SqlCommand sqlComm = new SqlCommand();
            sqlComm.Connection = conn;

            sqlComm.CommandText = "SELECT * FROM bills WHERE ( id = @id)";
            sqlComm.Parameters.Add("@id", SqlDbType.Int);
            // CTSECISSUE: InsecureDirectObjectReference
            sqlComm.Parameters["@id"].Value = id;

            conn.Open();
            SqlDataReader DR = sqlComm.ExecuteReader();

            // read the data and return
            return null;
        }

        public string GetBillDescription(int id)
        {
            // CTSECISSUE: UnsafeDatabaseResourceRelease
            // ruleid: sql-connection-opened
            SqlConnection conn = new SqlConnection("");
            // CTSECISSUE: UnsafeDatabaseResourceRelease
            SqlCommand sqlComm = new SqlCommand();
            sqlComm.Connection = conn;

            sqlComm.CommandText = "SELECT description FROM bills WHERE ( id = @id)";
            sqlComm.Parameters.Add("@id", SqlDbType.Int);
            // CTSECISSUE: InsecureDirectObjectReference
            sqlComm.Parameters["@id"].Value = id;

            conn.Open();
            SqlDataReader DR = sqlComm.ExecuteReader();
            // read the data and return
            return DR.GetString(1);
        }

        public Bill GetBillEF(int billid)
        {
            using (var context = new BillContext())
            {
                // CTSECISSUE: InsecureDirectObjectReference
                return context.Bills.Where(b => b.Id == billid).FirstOrDefault();
            }
        }

        public void AddBillEF(Bill bill)
        {
            using (var context = new BillContext())
            {
                // CTSECISSUE: MassAssignment
                context.Bills.Add(bill);
            }
        }

    }

    // ... (omitted)
}
